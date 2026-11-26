import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {MODEL_CURVE_MODE, MODEL_EMITTER_BUDGET, MODEL_EMITTER_REFUSAL} from '../src/react/preview3d/emitterModel.ts';
import {modelEmitterProfile} from '../src/react/preview3d/emitterProfileModel.ts';
import {applyFrame, frame, refused} from './preview3dActorFixture.ts';
import {changing, starting, stopping, withEmitters} from './preview3dEmitterActors.ts';
import {curve, emitterProfile} from './preview3dEmitterCases.ts';
import {EMITTER_WHERE as WHERE} from './preview3dEmitterRefusals.ts';

// The modules the stage draws in their constant modes: velocity over lifetime's linear velocity, and a main module that
// does not loop. Each refuses its curve modes by name (preview3dEmitterRefusals.ts holds those rows).
const {emitters: EMITTERS} = MODEL_EMITTER_BUDGET.load;

describe('velocity over lifetime', () => {
  it('reads each axis\'s linear velocity, a constant from m_ConstantMax and two constants between both', () => {
    const moving = emitterProfile();
    Object.assign(moving.velocitySettings, {linearX: curve(-0.5, 0.5), linearY: curve(9, 2, MODEL_CURVE_MODE.constant),
      linearZ: curve(0.25, -1)});
    assert.deepEqual(modelEmitterProfile(moving, WHERE).velocity, {min: [-0.5, 2, -1], max: [0.5, 2, 0.25]});
  });
  it('moves nothing when the module is off, whatever its values', () => {
    const off = emitterProfile();
    Object.assign(off.velocitySettings, {enabled: false, linearX: curve(0, 1, MODEL_CURVE_MODE.curve)});
    assert.deepEqual(modelEmitterProfile(off, WHERE).velocity, {min: [0, 0, 0], max: [0, 0, 0]});
  });
});

describe('a profile that does not loop', () => {
  const once = (duration: number) => {
    const profile = emitterProfile(8, 0.01);
    Object.assign(profile.mainSettings, {looping: false, duration});
    return profile;
  };
  const ids = Array.from({length: EMITTERS.most}, (_, index) => `once${index}`);
  const over = MODEL_EMITTER_REFUSAL.budget('emitters', EMITTERS.most + 1, EMITTERS.most);
  it('reads its duration, and emits for it only: its place in the budget frees when the duration ends', () => {
    const duration = 0.5;
    const read = modelEmitterProfile(once(duration), WHERE);
    assert.deepEqual([read.looping, read.duration], [false, duration]);
    const {actor} = withEmitters('a', {...Object.fromEntries(ids.map(id => [id, once(duration)])),
      loops: emitterProfile(8, 0.01)});
    applyFrame([actor], frame(0, changing(...starting(...ids))));
    refused(() => applyFrame([actor], frame(duration / 2, changing(...starting('loops')))), over);
    applyFrame([actor], frame(duration, changing(...starting('loops'))));
  });
  it('stops early when the engine stops it before its duration ends', () => {
    const {actor} = withEmitters('a', {...Object.fromEntries(ids.map(id => [id, once(10)])),
      loops: emitterProfile(8, 0.01)});
    applyFrame([actor], frame(0, changing(...starting(...ids))));
    applyFrame([actor], frame(1, changing(...stopping(...ids))));
    applyFrame([actor], frame(2, changing(...starting('loops'))));
  });
});
