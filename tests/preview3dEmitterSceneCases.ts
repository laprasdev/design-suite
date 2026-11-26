import {MODEL_CURVE_MODE, MODEL_EMITTER_ORIGIN, MODEL_RENDER_MODE, MODEL_UNITY_BUILTIN_MESH}
  from '../src/react/preview3d/emitterModel.ts';
import type {ModelEmitterRouted} from '../src/react/preview3d/emitterFrameModel.ts';
import {curve, emitterProfile} from './preview3dEmitterCases.ts';

// The emitter browser scene: one panel actor with three profiles, a point profile following it and one left where it
// started, and a mesh profile of Unity's built-in sphere following it.
const [SPHERE] = MODEL_UNITY_BUILTIN_MESH.meshes;
export const EMITTER_SCENE_ENTRY = 'tests/preview3dEmitterScene.tsx';
export const EMITTER_HOST_ID = 'emitter-host';
export const EMITTER_SCENE_PROFILES = Object.freeze({follows: emitterProfile(),
  stays: {...emitterProfile(), emitterOrigin: MODEL_EMITTER_ORIGIN.environment},
  spheres: {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh,
    mesh: {guid: MODEL_UNITY_BUILTIN_MESH.guid, fileID: SPHERE.fileID}}});
// The parts of a profile the modules runs set.
interface SceneProfile {readonly velocitySettings: object; readonly mainSettings: object}
/** What the scene's modules runs set on every profile: nothing, a rise (velocity over lifetime's linear velocity, up),
 * or one short emission that does not loop, whose particles have all died by the run's last frame. */
export const EMITTER_SCENE_MODULES = Object.freeze({own: <P extends SceneProfile>(profile: P) => profile,
  rising: <P extends SceneProfile>(profile: P) => ({...profile, velocitySettings: {...profile.velocitySettings,
    linearY: curve(1, 1, MODEL_CURVE_MODE.constant)}}),
  once: <P extends SceneProfile>(profile: P) => ({...profile, mainSettings: {...profile.mainSettings, looping: false,
    duration: 0.1}})});
export type EmitterSceneModules = keyof typeof EMITTER_SCENE_MODULES;
/** The scene's profiles with `modules` set on each. */
export const emitterSceneProfiles = (modules: EmitterSceneModules) => Object.fromEntries(
  Object.entries(EMITTER_SCENE_PROFILES).map(([id, profile]) => [id, EMITTER_SCENE_MODULES[modules](profile)]));
// Seconds between the frames that run the emitters, and how many: long enough for the oldest particles to die. The
// living frame is past the once run's duration but within its particles' shortest lifetime, so they are all alive.
export const EMITTER_SCENE_RUN = Object.freeze({step: 1 / 30, frames: 60, living: 15, travel: 0.6});
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
  /** The pixels changed at the run's living frame (`EMITTER_SCENE_RUN.living`). */
  readonly living: number;
  readonly pixels: number;
  /** The pixels of the smallest box holding every changed pixel, 0 when none changed. */
  readonly extent: number;
  /** The highest row of the picture a pixel changed in, counted up from its bottom; -1 when none changed. */
  readonly top: number;
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
    bootEmitterScene: (modules: EmitterSceneModules) => Promise<EmitterSceneDriver>;
    emitterScene: EmitterSceneDriver;
  }
}
