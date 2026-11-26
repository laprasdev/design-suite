import * as THREE from 'three';
import {MODEL_EMITTER_CHANGE, MODEL_NO_EMITTER_CHANGES, type ModelEmitterChange, type ModelEmitterRouted}
  from './emitterFrameModel.ts';
import {MODEL_EMITTER_BUDGET, MODEL_EMITTER_ORIGIN, modelDeclaredEmitter, modelEmitterCoverage,
  type ModelEmitterProfile, type ModelEmitterProfiles} from './emitterModel.ts';
import {MODEL_EMITTER_FORMS as FORMS, MODEL_EMITTER_PLACEHOLDER, modelParticleGeometry} from './emitterForms.ts';
import {MODEL_EMITTER_RUNNING as RUNNING, MODEL_EMITTER_SPAWN as SPAWN, MODEL_EMITTER_TIMES as TIMES,
  modelEmitterProgram} from './emitterProgram.ts';
import type {ModelStageCommit} from './commit.ts';
import {extendModelMaterial, type ModelShaderChange} from './shading.ts';
import type {ModelStageProgramValues} from './sharedValues.ts';

// An actor's particle emitters: one draw call per declared profile, simulated on the GPU, as points (`THREE.Points`)
// or as instances of the profile's mesh (one `InstancedBufferGeometry`). Each particle is a slot that re-spawns every
// `maxParticles / rate` seconds from the time the engine started the profile, and its program derives where it is, how
// big and what colour from that time and its seed alone, so a frame writes no particle: the stage writes its
// presentation time once into the shared numbers, and a profile that follows its actor copies one matrix.

// A uniform made from its values by name, each at the slot the program reads it from.
function slotted<Slot extends string>(slots: Readonly<Record<Slot, number>>, values: Readonly<Record<Slot, number>>) {
  const vector = new THREE.Vector3();
  for (const slot in slots) vector.setComponent(slots[slot], values[slot]);
  return vector;
}
function createEmitter(profile: ModelEmitterProfile, index: number, shared: ModelStageProgramValues,
  changes: (material: THREE.Material) => readonly ModelShaderChange[]) {
  const form = FORMS[profile.particle.form], geometry = modelParticleGeometry(profile);
  // How far past its spawn sphere a particle reaches: the culling bounds are this beyond the radius in force.
  const {velocity} = profile, drift = Math.hypot(...velocity.min.map((min, axis) =>
    Math.max(Math.abs(min), Math.abs(velocity.max[axis]))));
  const travel = (profile.speed.max + drift) * profile.lifetime.max + profile.size.max * profile.sizeScale.max;
  const bounds = new THREE.Sphere(new THREE.Vector3(), profile.radius + travel);
  geometry.boundingSphere = bounds;
  const times = slotted(TIMES, {started: 0, stopped: 0, running: RUNNING.no});
  const color = (tint: readonly number[]) => new THREE.Vector4(...profile.color).multiply(new THREE.Vector4(...tint));
  // The profile's own spawn and colours, which a start's routed values replace or multiply (`start`).
  const own = {spawn: slotted(SPAWN, {rate: profile.rate, particles: profile.maxParticles, radius: profile.radius}),
    colorMin: color(profile.tint.min), colorMax: color(profile.tint.max)};
  const spawn = own.spawn.clone(), colorMin = own.colorMin.clone(), colorMax = own.colorMax.clone();
  const uniforms = {emitterTimes: {value: times}, emitterSpawn: {value: spawn},
    emitterLifetime: {value: new THREE.Vector2(profile.lifetime.min, profile.lifetime.max)},
    emitterSpeed: {value: new THREE.Vector2(profile.speed.min, profile.speed.max)},
    emitterSize: {value: new THREE.Vector2(profile.size.min, profile.size.max)},
    emitterSizeScale: {value: new THREE.Vector2(profile.sizeScale.min, profile.sizeScale.max)},
    emitterLinearMin: {value: new THREE.Vector3(...velocity.min)},
    emitterLinearMax: {value: new THREE.Vector3(...velocity.max)},
    emitterColorMin: {value: colorMin}, emitterColorMax: {value: colorMax}};
  const material = form.material();
  Object.assign(material, {transparent: true, depthWrite: false, blending: MODEL_EMITTER_PLACEHOLDER.blending});
  extendModelMaterial(material, [modelEmitterProgram(profile.particle.form, uniforms, shared), ...changes(material)]);
  const particles = form.object(geometry, material);
  particles.matrixAutoUpdate = false;
  particles.matrixWorldAutoUpdate = false;
  particles.visible = false;
  return {profile, index, coverage: modelEmitterCoverage(profile), particles, geometry, material, times,
    own, spawn, colorMin, colorMax, bounds, travel, tint: new THREE.Vector4()};
}
type ModelEmitter = ReturnType<typeof createEmitter>;
// Whether an emitter emits at `time`: it runs with no stop set, or its stop is still to come.
const isEmitting = ({times}: ModelEmitter, time: number) =>
  times.getComponent(TIMES.running) === RUNNING.yes || time < times.getComponent(TIMES.stopped);
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

/** Actor `entity`'s emitters, at `origin` (its placement). Neither a load nor a change allocates: each writes into
 * what the emitters made once. */
export function createModelEmitters(entity: string, profiles: ModelEmitterProfiles, origin: THREE.Object3D,
  context: ModelEmittersContext) {
  const emitters: Readonly<Record<string, ModelEmitter>> = Object.freeze(Object.fromEntries(Object.entries(profiles)
    .map(([id, profile], index) => [id, createEmitter(profile, index, context.shared, context.changes)])));
  const all = Object.values(emitters);
  const following = all.filter(({profile}) => profile.origin === MODEL_EMITTER_ORIGIN.character);
  for (const {particles} of all) context.scene.add(particles);
  const emitter = (id: string) => modelDeclaredEmitter(emitters, entity, id);
  // Whether each emitter runs once a load's changes apply, by its index.
  const loaded = new Uint8Array(all.length);
  // The prepared changes: the frame's own records, the emitter each names, and the frame's time, held in a typed
  // array as the stage holds its times, since a double stored in an object's field is boxed.
  const pending = {changes: MODEL_NO_EMITTER_CHANGES, items: new Array<ModelEmitter>(), time: new Float64Array(1)};
  const commit: ModelStageCommit = () => {
    const {changes, items} = pending, time = pending.time[0];
    for (let index = 0; index < changes.length; index++) {
      const item = items[index], change = changes[index];
      if (change.change === MODEL_EMITTER_CHANGE.started) {
        start(item, change);
        const {looping, duration} = item.profile;
        item.times.setComponent(TIMES.started, time).setComponent(TIMES.stopped, looping ? time : time + duration)
          .setComponent(TIMES.running, looping ? RUNNING.yes : RUNNING.no);
        // The origin's world matrix is otherwise refreshed only when the stage next draws.
        origin.updateWorldMatrix(true, false);
        item.particles.matrixWorld.copy(origin.matrixWorld);
        item.particles.visible = true;
      } else if (isEmitting(item, time)) {
        item.times.setComponent(TIMES.stopped, time).setComponent(TIMES.running, RUNNING.no);
      }
    }
  };
  return {
    /** What emits once `changes` apply at the time `frameTime` holds, added into a load (`createModelEmitterLoad`). */
    addLoad(changes: readonly ModelEmitterChange[], frameTime: Float64Array, into: Float64Array) {
      for (let index = 0; index < all.length; index++) {
        loaded[index] = isEmitting(all[index], frameTime[0]) ? RUNNING.yes : RUNNING.no;
      }
      for (let index = 0; index < changes.length; index++) {
        loaded[emitter(changes[index].profile).index] =
          changes[index].change === MODEL_EMITTER_CHANGE.started ? RUNNING.yes : RUNNING.no;
      }
      let running = 0, coverage = 0;
      for (let index = 0; index < all.length; index++) {
        running += loaded[index];
        coverage += loaded[index] * all[index].coverage;
      }
      into[MODEL_EMITTER_BUDGET.load.emitters.slot] += running;
      into[MODEL_EMITTER_BUDGET.load.coverage.slot] += coverage;
    },
    /** Applies changes at the time `frameTime` holds: a start begins afresh from nothing, a stop lets particles live
     * out. */
    prepare(changes: readonly ModelEmitterChange[], frameTime: Float64Array): ModelStageCommit {
      for (let index = 0; index < changes.length; index++) pending.items[index] = emitter(changes[index].profile);
      pending.changes = changes;
      pending.time[0] = frameTime[0];
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
