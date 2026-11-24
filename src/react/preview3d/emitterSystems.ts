import * as THREE from 'three';
import {ConstantColor, ConstantValue, IntervalValue, ParticleSystem, RenderMode, SphereEmitter, Vector4}
  from 'three.quarks';
import type {ModelEmitterRouted} from './emitterFrameModel.ts';
import {MODEL_EMITTER_FORM, type ModelEmitterForm, type ModelEmitterParticle, type ModelEmitterProfile,
  type ModelEmitterRange} from './emitterModel.ts';

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
// The sphere the profile reader draws: its whole turn, emitting through its whole volume.
const WHOLE_SPHERE = Object.freeze({arc: Math.PI * 2, thickness: 1});
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

/** A profile as a three.quarks system, paused until the engine starts it, and how a start's routed values reach it. */
export function createModelEmitterSystem(profile: ModelEmitterProfile) {
  const material = placeholderMaterial(profile.particle), geometry = instancedGeometry(profile.particle);
  const own = new Vector4(...profile.color).multiply(new Vector4(...profile.tint));
  const startColor = new ConstantColor(own.clone()), rate = new ConstantValue(profile.rate);
  const shape = new SphereEmitter({radius: profile.radius, ...WHOLE_SPHERE});
  const system = new ParticleSystem({looping: true, worldSpace: false,
    startLife: generator(profile.lifetime), startSpeed: generator(profile.speed),
    startSize: generator(scaled(profile.size, profile.sizeScale)),
    startColor, emissionOverTime: rate, shape,
    renderMode: MODEL_EMITTER_RENDER[profile.particle.form].mode, instancingGeometry: geometry, material});
  system.pause();
  const tinted = new Vector4();
  return {system,
    /** Begins afresh from nothing with the profile's own values, with what the start routes in their place
     * (emitterFrameModel.ts states the rule). Writes into the generators made here. */
    start({rate: routedRate, tint, radius}: ModelEmitterRouted) {
      rate.value = routedRate ?? profile.rate;
      shape.radius = radius ?? profile.radius;
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
