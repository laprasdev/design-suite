import assert from 'node:assert/strict';
import {MODEL_EMITTER_CHANGE} from '../src/react/preview3d/emitterFrameModel.ts';
import {MODEL_CURVE_MODE, MODEL_EMITTER_ORIGIN} from '../src/react/preview3d/emitterModel.ts';
import {applyFrame, frame} from './preview3dActorFixture.ts';
import {changing, withEmitters} from './preview3dEmitterActors.ts';
import {curve, EMITTER_ID, emitterChange, emitterProfile} from './preview3dEmitterCases.ts';

// The test profile with its main, emission and shape settings changed, run as one actor's quarks system.
/** quarks' longest step of the batched renderer, in seconds. */
export const STEP = 0.1;
// Three cycles of 5, a fifth of a second apart from 0.05 s, each sure to fire, and the live particles as each step of
// the batched renderer by quarks' longest (0.1 s) ends: at 0.1 s the first cycle has fired, at 0.3 s the second.
export const CYCLES = Object.freeze({hasBurst: true, burstTime: 0.05, burstCount: 5, burstCycleCount: 3,
  burstRepeatInterval: 0.2, burstProbability: 1});
// Unity's Quaternion.Euler(-90, 90, 0) turns +Z to +Y and +X to -Z (about Z, then X, then Y).
export const UNITY_TURN = Object.freeze({x: -90, y: 90, z: 0});
export const TURNED_AXES = Object.freeze([[[0, 0, 1], [0, 1, 0]], [[1, 0, 0], [0, 0, -1]]] as const);
// Unity's rate over time held at nothing: a constant 0.
export const NO_RATE = curve(0, 0, MODEL_CURVE_MODE.constant);
export function stated(main: object, emission: object, shape: object, origin: number = MODEL_EMITTER_ORIGIN.character) {
  const profile = emitterProfile();
  return {...profile, emitterOrigin: origin, mainSettings: {...profile.mainSettings, ...main},
    emissionSettings: {...profile.emissionSettings, ...emission},
    shapeSettings: {...profile.shapeSettings, ...shape}};
}
export const system = (record: object) => withEmitters('a', {[EMITTER_ID]: record});
/** `record` started and stepped once: its batched renderer, and the particles it has emitted, at least one. */
export function emittedAfterStart(record: object) {
  const {actor, particles, systems: [burst]} = system(record);
  applyFrame([actor], frame(0, changing(emitterChange(MODEL_EMITTER_CHANGE.started))));
  particles.update(STEP);
  const emitted = burst.particles.slice(0, burst.particleNum);
  assert.ok(emitted.length > 0, 'the burst emitted nothing');
  return {particles, emitted};
}
