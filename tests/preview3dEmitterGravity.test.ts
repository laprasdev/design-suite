import assert from 'node:assert/strict';
import {beforeEach, describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_EMITTER_CHANGE} from '../src/react/preview3d/emitterFrameModel.ts';
import {MODEL_CURVE_MODE, MODEL_EMITTER_REFUSAL, MODEL_GRAVITY_SOURCE, MODEL_SIMULATION_SPACE}
  from '../src/react/preview3d/emitterModel.ts';
import {modelEmitterProfile} from '../src/react/preview3d/emitterProfileModel.ts';
import {createModelFrameBuffers, modelFrameScope, validateModelFrame} from '../src/react/preview3d/frameModel.ts';
import {MODEL_RECORD_REFUSAL} from '../src/react/preview3d/recordModel.ts';
import {applyFrame, applyValidated, entity, fileScene, frame, layer, makeActor, refused, sample, SCENE_GRAVITY}
  from './preview3dActorFixture.ts';
import {changing} from './preview3dEmitterActors.ts';
import {curve, EMITTER_ID, emitterChange, emitterProfile} from './preview3dEmitterCases.ts';
import {CYCLES, NO_RATE, STEP, stated, system, TURNED_AXES, UNITY_TURN} from './preview3dEmitterStated.ts';

// Unity's `main.gravityModifier`, drawn by quarks' `ApplyForce` (emitterGravity.ts) with the scene's gravity the
// engine's frame states (sceneGravity.ts), on emitted particles started still from the emitter's centre.
const constant = (value: number) => curve(value, value, MODEL_CURVE_MODE.constant);
const DOWN = Object.freeze([0, -9.81, 0] as const);
const UP = Object.freeze([0, 9.81, 0] as const);
const falling = (modifier: number, main: object = {}, shape: object = {}) => stated(
  {startSpeed: constant(0), gravityModifier: constant(modifier), ...main},
  {...CYCLES, burstCycleCount: 1, rateOverTime: NO_RATE}, {radius: 0, ...shape});
const starting = () => changing(emitterChange(MODEL_EMITTER_CHANGE.started));
const velocities = (record: object, frameGravity: readonly number[]) => {
  const {actor, particles, systems: [burst]} = system(record);
  applyFrame([actor], {...frame(0, starting()), gravity: frameGravity});
  particles.update(STEP);
  const emitted = burst.particles.slice(0, burst.particleNum);
  assert.ok(emitted.length > 0, 'the burst emitted nothing');
  const at = () => emitted.map(({velocity}) => new THREE.Vector3(velocity.x, velocity.y, velocity.z));
  const before = at();
  particles.update(STEP);
  return at().map((velocity, index) => velocity.sub(before[index]));
};
const near = (actual: readonly number[], expected: readonly number[], what: string) =>
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6, `${what}: ${actual}`));

describe('gravity modifier through three.quarks', () => {
  beforeEach(() => {
    SCENE_GRAVITY.acceleration.set(0, 0, 0);
    SCENE_GRAVITY.stated = false;
  });

  it('gains the frame\'s gravity times main.gravityModifier in each particle\'s velocity, each step', () => {
    for (const gained of velocities(falling(0.5), DOWN)) {
      near(gained.toArray(), DOWN.map(axis => axis * 0.5 * STEP), 'a step\'s gain');
    }
  });

  it('turns world gravity into a Local system\'s space by the emitter\'s rotation', () => {
    const local = falling(1, {simulationSpace: MODEL_SIMULATION_SPACE.local}, {rotation: UNITY_TURN});
    // The emitter turns its +Z to world +Y, so world -Y is its -Z.
    const [[from]] = TURNED_AXES;
    for (const gained of velocities(local, DOWN)) {
      near(gained.toArray(), from.map(axis => -axis * -DOWN[1] * STEP), 'the turned gain');
    }
  });

  it('refuses a start of a falling profile before any frame states the scene\'s gravity', () => {
    const {actor, visible} = system(falling(1));
    refused(() => applyFrame([actor], frame(0, starting())), MODEL_EMITTER_REFUSAL.noGravity('a', EMITTER_ID));
    assert.equal(visible(), 0);
  });

  it('keeps the gravity a frame stated for later frames that state none', () => {
    const {actor} = system(falling(1));
    applyFrame([actor], {...frame(0, {...starting(), emitters: []}), gravity: DOWN});
    applyFrame([actor], frame(0.1, starting()));
    assert.deepEqual(SCENE_GRAVITY.acceleration.toArray(), DOWN);
  });

  it('refuses a frame whose gravity is not three finite numbers, keeping the gravity held', () => {
    const {actor} = system(falling(1));
    applyFrame([actor], {...frame(0, {...starting(), emitters: []}), gravity: DOWN});
    for (const malformed of [[0, -9.81], 'down', [0, Number.NaN, 0]]) {
      refused(() => applyFrame([actor], {...frame(0.1, starting()), gravity: malformed}),
        MODEL_RECORD_REFUSAL.numbers('Frame gravity', DOWN.length));
    }
    assert.deepEqual(SCENE_GRAVITY.acceleration.toArray(), DOWN);
  });

  it('keeps the gravity held when a frame stating a new one is refused by another actor', () => {
    const {actor} = system(falling(1));
    const {actor: other} = makeActor('b', [{name: 'idle', duration: 2}]);
    applyFrame([actor, other], {...frame(0, {...starting(), emitters: []}), gravity: DOWN});
    refused(() => applyFrame([actor, other], {...frame(0.1, starting(), entity('b', [layer(sample('idle', 99))])),
      gravity: UP}), /^Actor b: clip idle time 99 lies outside/);
    assert.deepEqual(SCENE_GRAVITY.acceleration.toArray(), DOWN);
  });

  it('holds the gravity it validated, whatever the sender writes into its own array afterwards', () => {
    const {actor} = system(falling(1));
    const sent: number[] = [...DOWN];
    const checked = validateModelFrame({...frame(0, {...starting(), emitters: []}), gravity: sent},
      modelFrameScope(fileScene([actor.declaration]), new Map()), createModelFrameBuffers());
    sent[1] = Number.NaN;
    applyValidated([actor], checked, () => undefined);
    assert.deepEqual(SCENE_GRAVITY.acceleration.toArray(), DOWN);
  });

  it('draws a profile that never falls whatever its gravity source', () => {
    const profile = emitterProfile();
    const {gravityModifier} = modelEmitterProfile({...profile, mainSettings: {...profile.mainSettings,
      gravitySource: MODEL_GRAVITY_SOURCE.physics2D}}, 'Profile');
    assert.equal(gravityModifier, 0);
  });
});
