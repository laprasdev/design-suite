import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {CircleEmitter, ConeEmitter, HemisphereEmitter, SphereEmitter} from 'three.quarks';
import {MODEL_CURVE_MODE, MODEL_EMITTER_ORIGIN, MODEL_EMITTER_REFUSAL, MODEL_SHAPE_TYPE, MODEL_SIMULATION_SPACE}
  from '../src/react/preview3d/emitterModel.ts';
import {modelEmitterLiveBurstParticles} from '../src/react/preview3d/emitterBudgetModel.ts';
import {modelEmitterProfile} from '../src/react/preview3d/emitterProfileModel.ts';
import {MODEL_EMITTER_CHANGE} from '../src/react/preview3d/emitterFrameModel.ts';
import {applyFrame, frame, refused} from './preview3dActorFixture.ts';
import {changing, withEmitters} from './preview3dEmitterActors.ts';
import {curve, EMITTER_ID, emitterChange, emitterProfile} from './preview3dEmitterCases.ts';
import {EMITTER_WHERE as WHERE} from './preview3dEmitterRefusals.ts';

// Each of Unity's modules the stage draws through three.quarks, from the record's serialized field to the quarks
// system's own: what a pack states is what the system runs.
const {degToRad} = THREE.MathUtils;
const BURST = Object.freeze({hasBurst: true, burstTime: 0.25, burstCount: 90, burstCycleCount: 2,
  burstRepeatInterval: 0.5, burstProbability: 0.75});
// Three cycles of 5, a fifth of a second apart from 0.05 s, each sure to fire, and the live particles as each step of
// the batched renderer by quarks' longest (0.1 s) ends: at 0.1 s the first cycle has fired, at 0.3 s the second.
const CYCLES = Object.freeze({hasBurst: true, burstTime: 0.05, burstCount: 5, burstCycleCount: 3,
  burstRepeatInterval: 0.2, burstProbability: 1});
const STEP = 0.1, LIVE_AFTER_STEPS = Object.freeze([5, 5, 10, 10, 15, 15, 15]);
const OFFSET = Object.freeze({x: 0, y: 0.5, z: -0.25});
// An actor's pose turned a quarter about Y, doubled and moved: an emitter left where it started takes only its
// position, as ISM's C# places one.
const QUARTER = Math.SQRT1_2;
const TURNED = Object.freeze({position: [1, 2, 3], rotationQuaternion: [0, QUARTER, 0, QUARTER], scale: [2, 2, 2]});
// Unity's Quaternion.Euler(-90, 90, 0) turns +Z to +Y and +X to -Z (about Z, then X, then Y).
const UNITY_TURN = Object.freeze({x: -90, y: 90, z: 0});
const TURNED_AXES = Object.freeze([[[0, 0, 1], [0, 1, 0]], [[1, 0, 0], [0, 0, -1]]] as const);
// Unity's rate over time held at nothing: a constant 0.
const NO_RATE = curve(0, 0, MODEL_CURVE_MODE.constant);
const SHAPES = Object.freeze([[MODEL_SHAPE_TYPE.sphere, SphereEmitter],
  [MODEL_SHAPE_TYPE.hemisphere, HemisphereEmitter],
  [MODEL_SHAPE_TYPE.cone, ConeEmitter], [MODEL_SHAPE_TYPE.circle, CircleEmitter]] as const);
function stated(main: object, emission: object, shape: object, origin: number = MODEL_EMITTER_ORIGIN.character) {
  const profile = emitterProfile();
  return {...profile, emitterOrigin: origin, mainSettings: {...profile.mainSettings, ...main},
    emissionSettings: {...profile.emissionSettings, ...emission},
    shapeSettings: {...profile.shapeSettings, ...shape}};
}
const system = (record: object) => withEmitters('a', {[EMITTER_ID]: record});

describe('the Unity modules three.quarks draws', () => {
  it('runs main.looping, main.duration and main.simulationSpace World as quarks\' own', () => {
    const {systems: [once]} = system(stated({looping: false, duration: 0.69,
      simulationSpace: MODEL_SIMULATION_SPACE.world}, {}, {}));
    assert.deepEqual([once.looping, once.duration, once.worldSpace], [false, 0.69, true]);
    const {systems: [own]} = system(emitterProfile());
    assert.deepEqual([own.looping, own.worldSpace], [true, false]);
  });

  it('emits emission.burstCount at burstTime, each of burstCycleCount cycles burstRepeatInterval apart', () => {
    const {actor, particles, systems: [burst]} = system(stated({}, {...CYCLES, rateOverTime: NO_RATE}, {}));
    applyFrame([actor], frame(0, changing(emitterChange(MODEL_EMITTER_CHANGE.started))));
    const live = LIVE_AFTER_STEPS.map(() => {
      particles.update(STEP);
      return burst.particleNum;
    });
    assert.deepEqual(live, LIVE_AFTER_STEPS);
  });

  it('skips burstCycleCount 0, Unity\'s burst repeated forever, by name', () => {
    refused(() => modelEmitterProfile(stated({}, {...CYCLES, burstCycleCount: 0, rateOverTime: NO_RATE}, {}), WHERE),
      MODEL_EMITTER_REFUSAL.endlessBurst(`${WHERE}.emissionSettings.burstCycleCount`));
  });

  it('bounds the live burst particles by cycles a lifetime spans, and runs a looping lifetime overlaps', () => {
    const burst = (count: number, cycles: number, interval: number) =>
      [{time: 0, count, cycles, interval, probability: 1}];
    assert.equal(modelEmitterLiveBurstParticles(burst(30, 1, 0), 3, true, 2), 60, 'two looping runs overlap');
    assert.equal(modelEmitterLiveBurstParticles(burst(30, 1, 0), 3, false, 2), 30, 'one run');
    assert.equal(modelEmitterLiveBurstParticles(burst(10, 4, 1), 1.5, false, 5), 20, 'two of four cycles overlap');
    assert.equal(modelEmitterLiveBurstParticles(burst(10, 4, 0), 1.5, false, 5), 40, 'cycles at one time all live');
    assert.equal(modelEmitterLiveBurstParticles(burst(10, 4, 1), 1.5, false, 2), 20, 'cycles past the run fire none');
  });

  it('counts every burst cycle against main.maxParticles, and emits a burst with no rate over time', () => {
    const where = `${WHERE}.emissionSettings`, cap = emitterProfile().mainSettings.maxParticles;
    const over = stated({}, {...BURST, rateOverTime: NO_RATE, burstCount: cap / 2 + 1}, {});
    refused(() => modelEmitterProfile(over, WHERE), MODEL_EMITTER_REFUSAL.overCap(WHERE, 0,
      emitterProfile().mainSettings.startLifetime.m_ConstantMax, cap + 2, cap));
    refused(() => modelEmitterProfile(stated({}, {...BURST, burstCount: 0, rateOverTime: NO_RATE}, {}), WHERE),
      MODEL_EMITTER_REFUSAL.emitsNothing(where));
  });

  it('emits from each shape.shapeType as its quarks shape, with radius, radiusThickness, arc and angle', () => {
    for (const [shapeType, Shape] of SHAPES) {
      const {systems: [{emitterShape}]} = system(stated({}, {},
        {shapeType, radius: 0.4, radiusThickness: 0.1, arc: 180, angle: 25}));
      assert.ok(emitterShape instanceof Shape, `shape ${shapeType} is not a ${Shape.name}`);
      assert.deepEqual([emitterShape.radius, emitterShape.thickness, emitterShape.arc], [0.4, 0.1, degToRad(180)]);
      if (emitterShape instanceof ConeEmitter) assert.equal(emitterShape.angle, degToRad(25));
    }
  });

  it('offsets and turns the shape by shape.position and shape.rotation, under its actor or where it started', () => {
    const turned = {position: OFFSET, rotation: UNITY_TURN};
    const axes = (emitter: THREE.Object3D) => {
      const turn = emitter.getWorldQuaternion(new THREE.Quaternion());
      return TURNED_AXES.map(([axis]) => new THREE.Vector3(...axis).applyQuaternion(turn).toArray().map(Math.round));
    };
    const turnedAxes = TURNED_AXES.map(([, to]) => to);
    const {scene, systems: [follows]} = system(stated({}, {}, turned));
    assert.deepEqual(follows.emitter.position.toArray(), [OFFSET.x, OFFSET.y, OFFSET.z]);
    assert.notEqual(follows.emitter.parent, scene, 'it follows its actor');
    assert.deepEqual(axes(follows.emitter), turnedAxes);
    const {actor, systems: [stays]} = system(stated({}, {}, turned, MODEL_EMITTER_ORIGIN.environment));
    applyFrame([actor], frame(0, {...changing(emitterChange(MODEL_EMITTER_CHANGE.started)), pose: TURNED}));
    assert.deepEqual(stays.emitter.position.toArray(), [1 + OFFSET.x, 2 + OFFSET.y, 3 + OFFSET.z],
      'the start\'s position, offset in the world\'s axes');
    assert.deepEqual(axes(stays.emitter), turnedAxes, 'turned by its shape alone, not its actor');
  });
});
