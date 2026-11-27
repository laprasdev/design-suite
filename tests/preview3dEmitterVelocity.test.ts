import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_CURVE_MODE, MODEL_SIMULATION_SPACE} from '../src/react/preview3d/emitterModel.ts';
import {curve} from './preview3dEmitterCases.ts';
import {CYCLES, emittedAfterStart, NO_RATE, STEP, stated, TURNED_AXES, UNITY_TURN} from './preview3dEmitterStated.ts';

// Unity's velocity over lifetime, drawn by the stage's quarks behaviour (emitterVelocity.ts), on emitted particles.
// A burst of particles started still from the emitter's centre, so only velocity over lifetime moves them.
const STILL = Object.freeze({startSpeed: curve(0, 0, MODEL_CURVE_MODE.constant)});
const AT_CENTRE = Object.freeze({radius: 0});
const constant = (value: number) => curve(value, value, MODEL_CURVE_MODE.constant);
function moving(velocity: object, main: object = STILL, shape: object = AT_CENTRE) {
  const record = stated(main, {...CYCLES, burstCycleCount: 1, rateOverTime: NO_RATE}, shape);
  return {...record, velocitySettings: {...record.velocitySettings, enabled: true, speedModifier: constant(1),
    ...velocity}};
}
// Each emitted particle's travel over each of `steps` steps, from the step the burst fired in.
function travels(record: object, steps: number) {
  const {particles, emitted} = emittedAfterStart(record);
  const at = () => emitted.map(({position}) => position.clone());
  let last = at();
  return Array.from({length: steps}, () => {
    particles.update(STEP);
    const now = at(), moved = now.map((position, index) => position.clone().sub(last[index]));
    last = now;
    return moved;
  });
}
const near = (actual: readonly number[], expected: readonly number[], what: string) =>
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6, `${what}: ${actual}`));

describe('velocity over lifetime through three.quarks', () => {
  it('moves each particle by velocityOverLifetime.linearX, linearY and linearZ, a constant rate, not an acceleration',
    () => {
      for (const moved of travels(moving({linearY: constant(1)}), 3)) {
        for (const step of moved) near(step.toArray(), [0, STEP, 0], 'a step\'s travel');
      }
    });

  it('draws each axis of a TwoConstants linear velocity once a particle, between its constants', () => {
    const [first, second] = travels(moving({linearX: curve(-0.5, 0.5)}), 2);
    first.forEach((step, index) => near(step.toArray(), second[index].toArray(), 'a particle\'s own velocity'));
    assert.ok(first.every(({x}) => Math.abs(x) <= 0.5 * STEP + 1e-9), 'a draw outside the constants');
    assert.ok(new Set(first.map(({x}) => x.toFixed(9))).size > 1, 'one draw for every particle');
  });

  it('multiplies the start velocity and the linear one by velocityOverLifetime.speedModifier', () => {
    const half = moving({linearY: constant(1), speedModifier: constant(0.5)},
      {startSpeed: constant(1)}, {radius: 0.4, radiusThickness: 0});
    const {particles, emitted} = emittedAfterStart(half);
    const before = emitted.map(({position}) => position.clone());
    particles.update(STEP);
    const linear = new THREE.Vector3(0, 1, 0);
    emitted.forEach(({position, velocity}, index) => near(position.clone().sub(before[index]).toArray(),
      new THREE.Vector3(velocity.x, velocity.y, velocity.z).add(linear).multiplyScalar(0.5 * STEP).toArray(),
      'a halved step'));
  });

  it('turns a linear velocity stated in local space by the emitter\'s rotation in a World system', () => {
    const turned = moving({linearX: constant(1), space: MODEL_SIMULATION_SPACE.local},
      {...STILL, simulationSpace: MODEL_SIMULATION_SPACE.world}, {...AT_CENTRE, rotation: UNITY_TURN});
    const [, [, to]] = TURNED_AXES;
    for (const step of travels(turned, 1)[0]) near(step.toArray(), to.map(axis => axis * STEP), 'the turned step');
  });
});
