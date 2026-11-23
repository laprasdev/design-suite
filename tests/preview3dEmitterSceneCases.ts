import {MODEL_EMITTER_ORIGIN, MODEL_RENDER_MODE, MODEL_UNITY_BUILTIN_MESH}
  from '../src/react/preview3d/emitterModel.ts';
import {emitterProfile} from './preview3dEmitterCases.ts';

// The emitter browser scene: one panel actor with three profiles, a point profile following it and one left where it
// started, and a mesh profile of Unity's built-in sphere following it.
const [SPHERE] = MODEL_UNITY_BUILTIN_MESH.meshes;
export const EMITTER_SCENE_ENTRY = 'tests/preview3dEmitterScene.tsx';
export const EMITTER_HOST_ID = 'emitter-host';
export const EMITTER_SCENE_PROFILES = Object.freeze({follows: emitterProfile(),
  stays: {...emitterProfile(), emitterOrigin: MODEL_EMITTER_ORIGIN.environment},
  spheres: {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh,
    mesh: {guid: MODEL_UNITY_BUILTIN_MESH.guid, fileID: SPHERE.fileID}}});
// Seconds between the frames that run the emitters, and how many: long enough for the oldest particles to die.
export const EMITTER_SCENE_RUN = Object.freeze({step: 1 / 30, frames: 60, travel: 0.6});
/** A frame's draw calls: each instanced draw's instance count, and how many points draws. */
export interface EmitterDraws {readonly instances: readonly number[]; readonly points: number}
/** Pixels a picture changed from the one before, and of how many; the draws of the frame before and the last. */
export interface EmitterCoverage {
  readonly changed: number;
  readonly pixels: number;
  readonly draws: {readonly before: EmitterDraws; readonly after: EmitterDraws};
}
export interface EmitterSceneDriver {
  /** Draws the panel, starts every emitter and moves the panel while they run, counting the pixels they changed. */
  run(): Promise<EmitterCoverage>;
  /** Delivers `count` frames at once, each starting or stopping every emitter by turns when `changing`, none if not. */
  runTicks(count: number, changing: boolean): void;
}
declare global {
  interface Window {
    bootEmitterScene: () => Promise<EmitterSceneDriver>;
    emitterScene: EmitterSceneDriver;
  }
}
