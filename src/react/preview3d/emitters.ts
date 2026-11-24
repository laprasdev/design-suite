import * as THREE from 'three';
import {MODEL_EMITTER_CHANGE, MODEL_NO_EMITTER_CHANGES, type ModelEmitterChange, type ModelEmitterRouted}
  from './emitterFrameModel.ts';
import {MODEL_EMITTER_BUDGET, MODEL_EMITTER_ORIGIN, modelDeclaredEmitter, modelEmitterCoverage,
  type ModelEmitterDrawing, type ModelEmitterForm, type ModelEmitterProfile} from './emitterModel.ts';
import {MODEL_EMITTER_FORMS as FORMS, MODEL_EMITTER_PLACEHOLDER, modelParticleGeometry} from './emitterForms.ts';
import type {ModelStageCommit} from './commit.ts';
import {extendModelMaterial, type ModelShaderChange, type ModelShaderReplace} from './shading.ts';
import type {ModelStageProgramValues} from './sharedValues.ts';

// An actor's particle emitters: one draw call per declared profile, simulated on the GPU, as points (`THREE.Points`)
// or as instances of the profile's mesh (one `InstancedBufferGeometry`). Each particle is a slot that re-spawns every
// `maxParticles / rate` seconds from the time the engine started the profile, and its program derives where it is, how
// big and what colour from that time and its seed alone, so a frame writes no particle: the stage writes its
// presentation time once into the shared numbers, and a profile that follows its actor copies one matrix.
// The points form is built on three's points program, which hands a point its size (`scale`, set by three for points
// materials); the mesh form on three's basic mesh program, which scales the mesh's own vertices by the size.
// A profile's times uniform: when it started, when it stopped, and whether it runs (no stop holds while it does).
const TIMES = Object.freeze({started: 0, stopped: 1, running: 2});
// A profile's spawn uniform: particles a second, its cap, and the radius of the sphere they start in.
const SPAWN = Object.freeze({rate: 0, particles: 1, radius: 2});
const RUNNING = Object.freeze({no: 0, yes: 1});
const KEY = 'emitter';

const DECLARATIONS = `attribute float emitterSlot;
uniform vec3 emitterTimes;
uniform vec3 emitterSpawn;
uniform vec2 emitterLifetime;
uniform vec2 emitterSpeed;
uniform vec2 emitterSize;
uniform vec2 emitterSizeScale;
uniform vec4 emitterColorMin;
uniform vec4 emitterColorMax;
varying vec4 vEmitterColor;
varying float vEmitterSize;
vec4 emitterHash( vec2 p ) {
  vec4 q = fract( p.xyxy * vec4( 0.1031, 0.1030, 0.0973, 0.1099 ) );
  q += dot( q, q.wzxy + 33.33 );
  return fract( ( q.xxyz + q.yzzw ) * q.zywx );
}`;
// A particle's second hash, of its swapped slot and cycle moved this far, so its picks do not follow its seed.
const PICK_OFFSET = 17;
// Slot s of n at rate r was last born at start + (s + k n) / r, its latest k whose birth is not after the stop.
const SIMULATE = `float emitterPeriod = emitterSpawn.y / emitterSpawn.x;
float emitterUntil = mix( min( stagePresentationSeconds, emitterTimes.y ), stagePresentationSeconds, emitterTimes.z );
float emitterCycle = floor( ( ( emitterUntil - emitterTimes.x ) * emitterSpawn.x - emitterSlot ) / emitterSpawn.y );
float emitterBorn = emitterTimes.x + emitterSlot / emitterSpawn.x + emitterCycle * emitterPeriod;
float emitterAge = stagePresentationSeconds - emitterBorn;
vec4 emitterSeed = emitterHash( vec2( emitterSlot, emitterCycle ) );
vec4 emitterPick = emitterHash( vec2( emitterCycle, emitterSlot ) + ${PICK_OFFSET.toFixed(1)} );
float emitterLife = mix( emitterLifetime.x, emitterLifetime.y, emitterSeed.x );
float emitterAlive = step( 0.0, emitterCycle ) * step( emitterAge, emitterLife );
float emitterCos = emitterSeed.y * 2.0 - 1.0, emitterTurn = emitterSeed.z * PI2;
vec3 emitterDirection = vec3( sqrt( 1.0 - emitterCos * emitterCos ) * vec2( cos( emitterTurn ), sin( emitterTurn ) ),
  emitterCos );
float emitterOut = emitterSpawn.z * pow( emitterSeed.w, 1.0 / 3.0 ) +
  mix( emitterSpeed.x, emitterSpeed.y, emitterPick.x ) * emitterAge;
vec3 emitterCentre = emitterDirection * emitterOut;
vEmitterSize = emitterAlive * mix( emitterSize.x, emitterSize.y, emitterPick.y ) *
  mix( emitterSizeScale.x, emitterSizeScale.y, emitterPick.z );
vEmitterColor = mix( emitterColorMin, emitterColorMax, emitterPick.w );`;
function emitterChange(form: ModelEmitterForm, uniforms: Record<string, THREE.IUniform>,
  shared: ModelStageProgramValues): ModelShaderChange {
  const {place, project} = FORMS[form];
  return {key: `${KEY}-${form}`, apply(shader, replace: ModelShaderReplace) {
    Object.assign(shader.uniforms, shared.uniforms, uniforms);
    const declared = (source: string, varying: string) => replace(source, 'common',
      `#include <common>\n${shared.declarations}\n${varying}`);
    shader.vertexShader = replace(replace(declared(shader.vertexShader, DECLARATIONS), 'begin_vertex',
      `${SIMULATE}\n${place}`), 'fog_vertex', `#include <fog_vertex>\n${project}`);
    shader.fragmentShader = replace(declared(shader.fragmentShader, 'varying vec4 vEmitterColor;'),
      'color_fragment', `#include <color_fragment>\ndiffuseColor *= vEmitterColor;\n${
        MODEL_EMITTER_PLACEHOLDER.shade[form]}`);
  }};
}

function createEmitter(profile: ModelEmitterProfile, index: number, shared: ModelStageProgramValues,
  changes: (material: THREE.Material) => readonly ModelShaderChange[]) {
  const form = FORMS[profile.particle.form], geometry = modelParticleGeometry(profile);
  // How far past its spawn sphere a particle reaches: the culling bounds are this beyond the radius in force.
  const travel = profile.speed.max * profile.lifetime.max + profile.size.max * profile.sizeScale.max;
  const bounds = new THREE.Sphere(new THREE.Vector3(), profile.radius + travel);
  geometry.boundingSphere = bounds;
  const times = new THREE.Vector3(0, 0, RUNNING.no);
  const color = (tint: readonly number[]) => new THREE.Vector4(...profile.color).multiply(new THREE.Vector4(...tint));
  // The profile's own spawn and colours, which a start's routed values replace or multiply (`start`).
  const own = {spawn: new THREE.Vector3(profile.rate, profile.maxParticles, profile.radius),
    colorMin: color(profile.tint.min), colorMax: color(profile.tint.max)};
  const spawn = own.spawn.clone(), colorMin = own.colorMin.clone(), colorMax = own.colorMax.clone();
  const uniforms = {emitterTimes: {value: times}, emitterSpawn: {value: spawn},
    emitterLifetime: {value: new THREE.Vector2(profile.lifetime.min, profile.lifetime.max)},
    emitterSpeed: {value: new THREE.Vector2(profile.speed.min, profile.speed.max)},
    emitterSize: {value: new THREE.Vector2(profile.size.min, profile.size.max)},
    emitterSizeScale: {value: new THREE.Vector2(profile.sizeScale.min, profile.sizeScale.max)},
    emitterColorMin: {value: colorMin}, emitterColorMax: {value: colorMax}};
  const material = form.material();
  Object.assign(material, {transparent: true, depthWrite: false, blending: MODEL_EMITTER_PLACEHOLDER.blending});
  extendModelMaterial(material, [emitterChange(profile.particle.form, uniforms, shared), ...changes(material)]);
  const particles = form.object(geometry, material);
  particles.matrixAutoUpdate = false;
  particles.matrixWorldAutoUpdate = false;
  particles.visible = false;
  return {profile, index, coverage: modelEmitterCoverage(profile), particles, geometry, material, times,
    own, spawn, colorMin, colorMax, bounds, travel, tint: new THREE.Vector4()};
}
type ModelEmitter = ReturnType<typeof createEmitter>;
const isRunning = ({times}: ModelEmitter) => times.getComponent(TIMES.running) === RUNNING.yes;
// A start's routed values in force: the profile's own, with what the start routes in their place (emitterFrameModel.ts
// states the rule). Writes into what the emitter made once.
function start(item: ModelEmitter, {rate, tint, radius}: ModelEmitterRouted) {
  item.spawn.copy(item.own.spawn);
  if (rate !== undefined) item.spawn.setComponent(SPAWN.rate, rate);
  if (radius !== undefined) item.spawn.setComponent(SPAWN.radius, radius);
  if (tint === undefined) item.tint.setScalar(1);
  else item.tint.set(tint[0], tint[1], tint[2], 1);
  item.colorMin.copy(item.own.colorMin).multiply(item.tint);
  item.colorMax.copy(item.own.colorMax).multiply(item.tint);
  item.bounds.radius = item.spawn.getComponent(SPAWN.radius) + item.travel;
}

/** What an actor's emitters need from its stage: the scene they join, the shared numbers and the stage's changes. */
export interface ModelEmittersContext {
  readonly scene: THREE.Object3D;
  readonly shared: ModelStageProgramValues;
  readonly changes: (material: THREE.Material) => readonly ModelShaderChange[];
}

/** Actor `entity`'s emitters, at `origin` (its placement): one per drawn profile. A change naming a skipped profile
 * changes nothing. Neither a load nor a change allocates: each writes into what the emitters made once. */
export function createModelEmitters(entity: string, {drawn, skipped}: ModelEmitterDrawing,
  origin: THREE.Object3D, context: ModelEmittersContext) {
  const emitters: Readonly<Record<string, ModelEmitter>> = Object.freeze(Object.fromEntries(Object.entries(drawn)
    .map(([id, profile], index) => [id, createEmitter(profile, index, context.shared, context.changes)])));
  const all = Object.values(emitters);
  const following = all.filter(({profile}) => profile.origin === MODEL_EMITTER_ORIGIN.character);
  for (const {particles} of all) context.scene.add(particles);
  const skips: ReadonlySet<string> = new Set(skipped.map(({profile}) => profile));
  const emitter = (id: string) => skips.has(id) ? null : modelDeclaredEmitter(emitters, entity, id);
  // Whether each emitter runs once a load's changes apply, by its index.
  const loaded = new Uint8Array(all.length);
  // The prepared changes: the frame's own records, the emitter each names, and the frame's time, held in a typed
  // array as the stage holds its times, since a double stored in an object's field is boxed.
  const pending = {changes: MODEL_NO_EMITTER_CHANGES, items: new Array<ModelEmitter | null>(),
    time: new Float64Array(1)};
  const commit: ModelStageCommit = () => {
    const {changes, items} = pending, time = pending.time[0];
    for (let index = 0; index < changes.length; index++) {
      const item = items[index], change = changes[index];
      if (item !== null && change.change === MODEL_EMITTER_CHANGE.started) {
        start(item, change);
        item.times.set(time, time, RUNNING.yes);
        // The origin's world matrix is otherwise refreshed only when the stage next draws.
        origin.updateWorldMatrix(true, false);
        item.particles.matrixWorld.copy(origin.matrixWorld);
        item.particles.visible = true;
      } else if (item !== null && isRunning(item)) {
        item.times.setComponent(TIMES.stopped, time).setComponent(TIMES.running, RUNNING.no);
      }
    }
  };
  return {
    /** What runs once `changes` apply, added into a load (`createModelEmitterLoad`). */
    addLoad(changes: readonly ModelEmitterChange[], into: Float64Array) {
      for (let index = 0; index < all.length; index++) loaded[index] = isRunning(all[index]) ? RUNNING.yes : RUNNING.no;
      for (let index = 0; index < changes.length; index++) {
        const item = emitter(changes[index].profile);
        if (item === null) continue;
        loaded[item.index] = changes[index].change === MODEL_EMITTER_CHANGE.started ? RUNNING.yes : RUNNING.no;
      }
      let running = 0, coverage = 0;
      for (let index = 0; index < all.length; index++) {
        running += loaded[index];
        coverage += loaded[index] * all[index].coverage;
      }
      into[MODEL_EMITTER_BUDGET.load.emitters.slot] += running;
      into[MODEL_EMITTER_BUDGET.load.coverage.slot] += coverage;
    },
    /** Applies changes at the frame's time: a start begins afresh from nothing, a stop lets particles live out. */
    prepare(changes: readonly ModelEmitterChange[], time: number): ModelStageCommit {
      for (let index = 0; index < changes.length; index++) pending.items[index] = emitter(changes[index].profile);
      pending.changes = changes;
      pending.time[0] = time;
      return commit;
    },
    /** Each frame: the emitters that follow the actor take its matrix. Allocates nothing. */
    follow() {
      for (let index = 0; index < following.length; index++) {
        following[index].particles.matrixWorld.copy(origin.matrixWorld);
      }
    },
    dispose() {
      for (const {particles, geometry, material} of all) {
        particles.removeFromParent();
        geometry.dispose();
        material.dispose();
      }
    },
  };
}
export type ModelEmitters = ReturnType<typeof createModelEmitters>;
