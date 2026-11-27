import assert from 'node:assert/strict';
import {beforeEach, describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_EMITTER_CHANGE, MODEL_EMITTER_START, modelEmitterChanges}
  from '../src/react/preview3d/emitterFrameModel.ts';
import {MODEL_CURVE_MODE, MODEL_EMITTER_REFUSAL, MODEL_GRAVITY_SOURCE, MODEL_SIMULATION_SPACE}
  from '../src/react/preview3d/emitterModel.ts';
import {MODEL_EMITTER_DRAWN} from '../src/react/preview3d/emitterValueModel.ts';
import {modelEmitterProfile} from '../src/react/preview3d/emitterProfileModel.ts';
import {ModelEmitterGravityForce} from '../src/react/preview3d/emitterGravity.ts';
import {applyFrame, frame, refused} from './preview3dActorFixture.ts';
import {changing} from './preview3dEmitterActors.ts';
import {curve, EMITTER_ID, emitterChange, emitterProfile} from './preview3dEmitterCases.ts';
import {CYCLES, NO_RATE, STEP, stated, system, TURNED_AXES, UNITY_TURN} from './preview3dEmitterStated.ts';

// Unity's `main.gravityModifier`, drawn by quarks' `ApplyForce` (emitterGravity.ts) with the acceleration the engine's
// start states (the modifier times the scene's gravity, worked out by the engine), on particles started still.
const constant = (value: number) => curve(value, value, MODEL_CURVE_MODE.constant);
const DOWN = Object.freeze([0, -9.81, 0] as const);
const falling = (modifier: number, main: object = {}, shape: object = {}) => stated(
  {startSpeed: constant(0), gravityModifier: constant(modifier), ...main},
  {...CYCLES, burstCycleCount: 1, rateOverTime: NO_RATE}, {radius: 0, ...shape});
const START = Object.freeze({profile: EMITTER_ID, change: MODEL_EMITTER_CHANGE.started});
const started = (gravity?: readonly number[]) => gravity === undefined ? START : {...START, gravity};
const velocities = (record: object, gravity?: readonly number[]) => {
  const {actor, particles, systems: [burst]} = system(record);
  applyFrame([actor], frame(0, changing(started(gravity))));
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
  it('gains the start\'s gravity in each particle\'s velocity each step, as stated, never times the modifier', () => {
    // The engine multiplied already: a modifier of 2 changes nothing the stage draws.
    for (const gained of velocities(falling(2), DOWN)) near(gained.toArray(), DOWN.map(axis => axis * STEP), 'gain');
  });

  it('turns world gravity into a Local system\'s space by the emitter\'s rotation', () => {
    const local = falling(1, {simulationSpace: MODEL_SIMULATION_SPACE.local}, {rotation: UNITY_TURN});
    // The emitter turns its +Z to world +Y, so world -Y is its -Z.
    const [[from]] = TURNED_AXES;
    for (const gained of velocities(local, DOWN)) {
      near(gained.toArray(), from.map(axis => -axis * -DOWN[1] * STEP), 'the turned gain');
    }
  });

  // Whether it falls or not, a drawn profile's start states its gravity, and one that never falls states none.
  const REFUSED_STARTS = [{modifier: 1, gravity: undefined, refusal: MODEL_EMITTER_REFUSAL.noGravity},
    {modifier: 0, gravity: undefined, refusal: MODEL_EMITTER_REFUSAL.noGravity},
    {modifier: 0, gravity: DOWN, refusal: MODEL_EMITTER_REFUSAL.fallsByNone}] as const;
  it('refuses a start without its gravity, and one of a profile that never falls stating some, drawing nothing', () => {
    for (const {modifier, gravity, refusal} of REFUSED_STARTS) {
      const {actor, visible} = system(falling(modifier));
      refused(() => applyFrame([actor], frame(0, changing(started(gravity)))), refusal('a', EMITTER_ID));
      assert.equal(visible(), 0);
    }
  });

  it('carries the gravity force only on a profile that falls', () => {
    const forces = (modifier: number) => system(falling(modifier)).systems[0].behaviors
      .filter(behavior => behavior instanceof ModelEmitterGravityForce).length;
    assert.deepEqual([forces(0), forces(1)], [0, 1]);
  });

  it('draws the engine\'s zero gravity for a profile whose modifier is 0', () => {
    for (const gained of velocities(falling(0), [0, 0, 0])) near(gained.toArray(), [0, 0, 0], 'gain');
  });

  it('refuses by name a gravity that is not three finite numbers, and one on a stop', () => {
    for (const malformed of [[0, -9.81], 'down', [0, Number.NaN, 0]]) {
      refused(() => modelEmitterChanges([{...started(), gravity: malformed}], 'a'),
        MODEL_EMITTER_REFUSAL.startValue('a', EMITTER_ID, 'gravity', MODEL_EMITTER_START.gravity.is));
    }
    refused(() => modelEmitterChanges([{...emitterChange(MODEL_EMITTER_CHANGE.stopped), gravity: DOWN}], 'a'),
      MODEL_EMITTER_REFUSAL.startOff('a', EMITTER_ID, 'gravity', MODEL_EMITTER_CHANGE.stopped));
  });

  // That these are the fields of the engine's `EmitterChange` is ISM's check (synth-web emitterChangeFields.test.ts).
  it('refuses a started record\'s field the engine does not name', () => {
    refused(() => modelEmitterChanges([{...started(DOWN), fallsBy: DOWN}], 'a'), /fallsBy/);
  });

  it('refuses a profile on the 2D source, which the engine states no gravity for, even one that never falls', () => {
    const profile = emitterProfile(), where = 'Profile.mainSettings.gravitySource';
    refused(() => modelEmitterProfile({...profile, mainSettings: {...profile.mainSettings,
      gravitySource: MODEL_GRAVITY_SOURCE.physics2D}}, 'Profile'),
      MODEL_EMITTER_REFUSAL.undrawn(where, MODEL_GRAVITY_SOURCE.physics2D, MODEL_EMITTER_DRAWN.gravitySource));
  });
});
