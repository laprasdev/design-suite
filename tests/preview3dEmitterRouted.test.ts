import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_EMITTER_REFUSAL} from '../src/react/preview3d/emitterModel.ts';
import {modelEmitterProfile} from '../src/react/preview3d/emitterProfileModel.ts';
import {MODEL_EMITTER_CHANGE, MODEL_EMITTER_ROUTED, modelEmitterChanges}
  from '../src/react/preview3d/emitterFrameModel.ts';
import {applyFrame, frame, refused} from './preview3dActorFixture.ts';
import {compiled, program} from './preview3dCompiledProgram.ts';
import {changing, starting, withEmitters} from './preview3dEmitterActors.ts';
import {EMITTER_ID, EMITTER_ROUTED, emitterChange, emitterProfile} from './preview3dEmitterCases.ts';
import {EMITTER_WHERE as WHERE} from './preview3dEmitterRefusals.ts';

// A start's routed values: what the frame reader takes and refuses, and what the drawn emitter bounds by.
describe('an emitter start\'s routed values', () => {
  it('refuses by name a routed value out of its range, and one on a stop', () => {
    const started = emitterChange(MODEL_EMITTER_CHANGE.started);
    const cases = [['rate', 0], ['rate', Number.NaN], ['radius', -1], ['tint', [1, 1]], ['tint', [1, -1, 1]],
      ['tint', 1]] as const;
    for (const [field, value] of cases) {
      refused(() => modelEmitterChanges([{...started, [field]: value}], 'a'),
        MODEL_EMITTER_REFUSAL.routedValue('a', EMITTER_ID, field, MODEL_EMITTER_ROUTED[field].is));
    }
    refused(() => modelEmitterChanges([{...emitterChange(MODEL_EMITTER_CHANGE.stopped), rate: 3}], 'a'),
      MODEL_EMITTER_REFUSAL.routedOff('a', EMITTER_ID, 'rate', MODEL_EMITTER_CHANGE.stopped));
  });
  it('bounds a start by its routed radius, and by the profile\'s own when a later start leaves it out', () => {
    const {actor, points: [points]} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    const profile = modelEmitterProfile(emitterProfile(), WHERE), reach = () => points.geometry.boundingSphere?.radius;
    applyFrame([actor], frame(0, changing(...starting(EMITTER_ID))));
    const own = reach();
    applyFrame([actor], frame(1, changing({...emitterChange(MODEL_EMITTER_CHANGE.started), ...EMITTER_ROUTED})));
    assert.equal(reach(), (own ?? Number.NaN) + EMITTER_ROUTED.radius - profile.radius);
    applyFrame([actor], frame(2, changing(...starting(EMITTER_ID))));
    assert.equal(reach(), own);
  });
  it('multiplies a start\'s routed tint into the profile\'s colours, and draws the profile\'s own without one',
  () => {
    const {actor, points: [points]} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    const {uniforms} = compiled(points.material, program('points')), held = [uniforms.emitterColorMin.value,
      uniforms.emitterColorMax.value];
    const profile = modelEmitterProfile(emitterProfile(), WHERE), [r, g, b] = EMITTER_ROUTED.tint;
    const colors = (tint: THREE.Vector4) => [profile.tint.min, profile.tint.max].map(stop =>
      new THREE.Vector4(...profile.color).multiply(new THREE.Vector4(...stop)).multiply(tint).toArray());
    const drawn = () => held.map(value => {
      assert.ok(value instanceof THREE.Vector4, 'an emitter colour is not a four-channel vector');
      return value.toArray();
    });
    applyFrame([actor], frame(0, changing({...emitterChange(MODEL_EMITTER_CHANGE.started), ...EMITTER_ROUTED})));
    assert.deepEqual(drawn(), colors(new THREE.Vector4(r, g, b, 1)));
    applyFrame([actor], frame(1, changing(...starting(EMITTER_ID))));
    assert.deepEqual(drawn(), colors(new THREE.Vector4(1, 1, 1, 1)));
  });
});
