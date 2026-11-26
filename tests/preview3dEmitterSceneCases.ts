import {MODEL_EMITTER_ORIGIN, MODEL_RENDER_MODE, MODEL_UNITY_BUILTIN_MESH}
  from '../src/react/preview3d/emitterModel.ts';
import type {ModelEmitterRouted} from '../src/react/preview3d/emitterFrameModel.ts';
import {stageLook} from './preview3dActorFixture.ts';
import {emitterProfile} from './preview3dEmitterCases.ts';

// The emitter browser scene: one panel actor with four profiles, a point profile following it and one left where it
// started, a mesh profile of Unity's built-in sphere following it, and one naming a mesh the stage does not draw yet,
// which it skips: its frames' starts and stops run the skipped route.
const [SPHERE] = MODEL_UNITY_BUILTIN_MESH.meshes;
export const EMITTER_SCENE_ENTRY = 'tests/preview3dEmitterScene.tsx';
export const EMITTER_HOST_ID = 'emitter-host';
export const EMITTER_SCENE_PROFILES = Object.freeze({follows: emitterProfile(),
  stays: {...emitterProfile(), emitterOrigin: MODEL_EMITTER_ORIGIN.environment},
  spheres: {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh,
    mesh: {guid: MODEL_UNITY_BUILTIN_MESH.guid, fileID: SPHERE.fileID}},
  skipped: {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh,
    mesh: {guid: MODEL_UNITY_BUILTIN_MESH.guid, fileID: `${SPHERE.fileID}0`}}});
// The scene's one time: glow on what passes a high threshold, so the frame does not haze, and black fog past the
// panel, so the captures show the particles' halo and their fade with depth; black, since added light fogged toward
// any other colour would add that colour.
export const EMITTER_SCENE_LIGHTING = Object.freeze({time: 'dusk', times: [{id: 'dusk', label: 'Dusk',
  look: stageLook({glow: {threshold: 1, strength: 0.5, radius: 0},
    fog: {near: {distance: 3, color: [0, 0, 0]}, far: {distance: 10, color: [0, 0, 0]}, height: null}})}]});
// Seconds between the frames that run the emitters, and how many: long enough for the oldest particles to die.
export const EMITTER_SCENE_RUN = Object.freeze({step: 1 / 30, frames: 60, travel: 0.6});
/** The routed values the scene's runs start every emitter with: none (each profile's own), and each value moved far
 * enough from the profile's to change the picture by itself. */
export const EMITTER_SCENE_ROUTED = Object.freeze({own: Object.freeze({}),
  dark: Object.freeze({tint: Object.freeze([0, 0, 0] as const)}),
  sparse: Object.freeze({rate: 20}), wide: Object.freeze({radius: 1.5})} satisfies Record<string, ModelEmitterRouted>);
/** A frame's draw calls: each instanced draw's instance count, and how many points draws. */
export interface EmitterDraws {readonly instances: readonly number[]; readonly points: number}
/** Pixels a picture changed from the one before, and of how many; the draws of the frame before and the last. */
export interface EmitterCoverage {
  readonly changed: number;
  readonly pixels: number;
  /** The pixels of the smallest box holding every changed pixel, 0 when none changed. */
  readonly extent: number;
  readonly draws: {readonly before: EmitterDraws; readonly after: EmitterDraws};
}
export interface EmitterSceneDriver {
  /** Draws the panel, starts every emitter with `routed` and moves the panel while they run, counting the pixels they
   * changed. */
  run(routed: ModelEmitterRouted): Promise<EmitterCoverage>;
  /** Delivers `count` frames at once, each starting (with every routed value) or stopping every emitter by turns when
   * `changing`, none if not. */
  runTicks(count: number, changing: boolean): void;
}
declare global {
  interface Window {
    bootEmitterScene: () => Promise<EmitterSceneDriver>;
    emitterScene: EmitterSceneDriver;
  }
}
