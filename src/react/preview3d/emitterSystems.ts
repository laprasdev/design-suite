import * as THREE from 'three';
import {type BurstParameters, CircleEmitter, ConeEmitter, ConstantColor, ConstantValue, type EmitterShape,
  HemisphereEmitter, IntervalValue, ParticleSystem, RenderMode, SphereEmitter, Vector4} from 'three.quarks';
import type {ModelEmitterRouted} from './emitterFrameModel.ts';
import type {ModelVector} from './placementModel.ts';
import {MODEL_EMITTER_FORM, MODEL_SHAPE_TYPE, type ModelEmitterDrawnShape, type ModelEmitterForm,
  type ModelEmitterParticle, type ModelEmitterProfile, type ModelEmitterRange, type ModelEmitterShape}
  from './emitterModel.ts';
import {modelEmitterBurstCycles} from './emitterBudgetModel.ts';
import {VelocityOverLifetime} from './emitterVelocity.ts';
import {ModelEmitterGravityForce} from './emitterGravity.ts';

// The one mapping from a profile the stage draws onto three.quarks, its particle simulator and drawer (the particle
// contract's section 5): each profile is one quarks system, which the stage's one batched renderer steps and draws
// (scene.ts). What the profile reader refuses never reaches here (emitterProfileModel.ts). quarks draws every random
// value from `Math.random` and takes no generator, so a start's draws are not reproducible run to run.
/** The particle's look until the owner decides its material: added light, a billboard drawn as a soft disc this many
 * texels across, a mesh unlit. A named placeholder. */
export const MODEL_EMITTER_PLACEHOLDER = Object.freeze({blending: THREE.AdditiveBlending, disc: 32});
/** How quarks draws each form: its render mode, and the position in its batch's space its program gives a vertex (a
 * billboard's centre, `offset`; a mesh vertex through the particle's own matrix), which the stage's fog reads. */
export const MODEL_EMITTER_RENDER = Object.freeze({
  [MODEL_EMITTER_FORM.points]: Object.freeze({mode: RenderMode.BillBoard, transformed: 'offset'}),
  [MODEL_EMITTER_FORM.mesh]: Object.freeze({mode: RenderMode.Mesh,
    transformed: '( matrix * vec4( position, 1.0 ) ).xyz'}),
} satisfies Record<ModelEmitterForm, {readonly mode: RenderMode; readonly transformed: string}>);
// Each of Unity's shapes the profile reader draws (`MODEL_EMITTER_DRAWN_SHAPES`) as the quarks shape that emits as it
// does: from `radius` (Unity's `shape.radius`), its outer `thickness` share (`radiusThickness`), over `arc` (`arc`),
// and, for a cone, spreading along +Z by `angle` (`angle`) at the cone's rim, as Unity's cone does.
const {degToRad} = THREE.MathUtils;
const SHAPES = Object.freeze({
  [MODEL_SHAPE_TYPE.sphere]: ({radius, thickness, arc}: ModelEmitterShape) =>
    new SphereEmitter({radius, thickness, arc: degToRad(arc)}),
  [MODEL_SHAPE_TYPE.hemisphere]: ({radius, thickness, arc}: ModelEmitterShape) =>
    new HemisphereEmitter({radius, thickness, arc: degToRad(arc)}),
  [MODEL_SHAPE_TYPE.cone]: ({radius, thickness, arc, angle}: ModelEmitterShape) =>
    new ConeEmitter({radius, thickness, arc: degToRad(arc), angle: degToRad(angle)}),
  [MODEL_SHAPE_TYPE.circle]: ({radius, thickness, arc}: ModelEmitterShape) =>
    new CircleEmitter({radius, thickness, arc: degToRad(arc)}),
} satisfies Record<ModelEmitterDrawnShape, (shape: ModelEmitterShape) => EmitterShape>);
// Unity's bursts (`emission.burstTime`, `burstCount`, `burstCycleCount`, `burstRepeatInterval`, `burstProbability`) as
// quarks' own, one for each cycle a run fires: quarks fires each of its bursts once a run at its `time`, reading no
// `cycle` or `interval`, and Unity rolls `probability` for each cycle.
const emissionBursts = ({bursts, duration}: ModelEmitterProfile): BurstParameters[] => bursts.flatMap(burst =>
  Array.from({length: modelEmitterBurstCycles(burst, duration)}, (_, cycle) => ({time: burst.time +
    cycle * burst.interval, count: new ConstantValue(burst.count), cycle: 1, interval: 0,
    probability: burst.probability}))).sort((first, second) => first.time - second.time);
const RGBA = 4, OPAQUE = 255;

// A white disc whose alpha falls from its centre to nothing at its edge.
function discTexture() {
  const {disc} = MODEL_EMITTER_PLACEHOLDER, half = disc / 2, texels = new Uint8Array(disc * disc * RGBA).fill(OPAQUE);
  for (let y = 0; y < disc; y++) {
    for (let x = 0; x < disc; x++) {
      const reach = Math.hypot(x + 0.5 - half, y + 0.5 - half) / half;
      texels[(y * disc + x) * RGBA + RGBA - 1] = Math.round(OPAQUE * Math.max(0, 1 - reach));
    }
  }
  const texture = new THREE.DataTexture(texels, disc, disc);
  texture.needsUpdate = true;
  return texture;
}
const placeholderMaterial = (particle: ModelEmitterParticle) => new THREE.MeshBasicMaterial({transparent: true,
  depthWrite: false, blending: MODEL_EMITTER_PLACEHOLDER.blending,
  map: particle.form === MODEL_EMITTER_FORM.points ? discTexture() : null});
// A built-in mesh's geometry, from its row's segments; a billboard draws quarks' own quad.
const instancedGeometry = (particle: ModelEmitterParticle) => particle.form === MODEL_EMITTER_FORM.mesh ?
  new THREE.SphereGeometry(particle.mesh.segments.radius, particle.mesh.segments.widthSegments,
    particle.mesh.segments.heightSegments) : undefined;
// Unity's Constant is quarks' constant; TwoConstants a value drawn once a particle, between them.
const generator = ({min, max}: ModelEmitterRange) => min === max ? new ConstantValue(min) : new IntervalValue(min, max);
// A constant over-lifetime factor (the profile reader draws no other) multiplies the start value for the particle's
// whole life, so it folds into the start value exactly, as Unity's size and colour over lifetime multiply it.
const scaled = ({min, max}: ModelEmitterRange, scale: number) => ({min: min * scale, max: max * scale});

/** A profile as a three.quarks system, paused until the engine starts it, and how a start's routed values and the
 * gravity it falls by reach it. */
export function createModelEmitterSystem(profile: ModelEmitterProfile) {
  const material = placeholderMaterial(profile.particle), geometry = instancedGeometry(profile.particle);
  const own = new Vector4(...profile.color).multiply(new Vector4(...profile.tint));
  const startColor = new ConstantColor(own.clone()), rate = new ConstantValue(profile.rate);
  const shape = SHAPES[profile.shape.type](profile.shape);
  // Unity's `main.looping`, `main.duration` and `main.simulationSpace`, and its bursts.
  const system = new ParticleSystem({looping: profile.looping, duration: profile.duration,
    worldSpace: profile.worldSpace, emissionBursts: emissionBursts(profile),
    startLife: generator(profile.lifetime), startSpeed: generator(profile.speed),
    startSize: generator(scaled(profile.size, profile.sizeScale)),
    startColor, emissionOverTime: rate, shape,
    renderMode: MODEL_EMITTER_RENDER[profile.particle.form].mode, instancingGeometry: geometry, material});
  if (profile.velocity) {
    const {linear: [x, y, z], speedModifier, worldSpace} = profile.velocity;
    system.addBehavior(new VelocityOverLifetime([generator(x), generator(y), generator(z)], generator(speedModifier),
      system.emitter, {stated: worldSpace, system: profile.worldSpace}));
  }
  // Only a profile that falls carries the force; one that does not states none on each start (emitters.ts `prepare`).
  const gravity = profile.falls ? new ModelEmitterGravityForce(system.emitter, profile.worldSpace) : null;
  if (gravity !== null) system.addBehavior(gravity);
  system.pause();
  const tinted = new Vector4();
  return {system,
    /** Begins afresh from nothing with the profile's own values, with what the start routes in their place
     * (emitterFrameModel.ts states the rule). Writes into the generators made here. */
    start({rate: routedRate, tint, radius}: ModelEmitterRouted, falls: ModelVector) {
      gravity?.fallBy(falls);
      rate.value = routedRate ?? profile.rate;
      shape.radius = radius ?? profile.shape.radius;
      if (tint === undefined) tinted.setScalar(1);
      else tinted.set(tint[0], tint[1], tint[2], 1);
      startColor.color.copy(own).multiply(tinted);
      system.restart();
    },
    dispose() {
      system.dispose();
      material.map?.dispose();
      material.dispose();
      geometry?.dispose();
    }};
}
export type ModelEmitterSystem = ReturnType<typeof createModelEmitterSystem>;
