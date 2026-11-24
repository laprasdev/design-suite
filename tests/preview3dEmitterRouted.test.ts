import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {ConstantColor, ConstantValue, SphereEmitter, Vector4} from 'three.quarks';
import {MODEL_EMITTER_REFUSAL} from '../src/react/preview3d/emitterModel.ts';
import {modelEmitterProfile} from '../src/react/preview3d/emitterProfileModel.ts';
import {MODEL_EMITTER_CHANGE, MODEL_EMITTER_ROUTED, modelEmitterChanges}
  from '../src/react/preview3d/emitterFrameModel.ts';
import {applyFrame, frame, refused} from './preview3dActorFixture.ts';
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
  it('emits at a start\'s routed rate and radius, and at the profile\'s own when a later start leaves them out', () => {
    const {actor, systems: [system]} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    const profile = modelEmitterProfile(emitterProfile(), WHERE);
    const {emissionOverTime: rate, emitterShape: shape} = system;
    assert.ok(rate instanceof ConstantValue && shape instanceof SphereEmitter, 'not a constant rate from a sphere');
    applyFrame([actor], frame(0, changing({...emitterChange(MODEL_EMITTER_CHANGE.started), ...EMITTER_ROUTED})));
    assert.deepEqual([rate.value, shape.radius], [EMITTER_ROUTED.rate, EMITTER_ROUTED.radius]);
    applyFrame([actor], frame(1, changing(...starting(EMITTER_ID))));
    assert.deepEqual([rate.value, shape.radius], [profile.rate, profile.radius]);
  });
  it('refuses by name a routed rate whose particles its cap cannot hold, changing nothing', () => {
    const {actor, visible} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    const {lifetime, maxParticles} = modelEmitterProfile(emitterProfile(), WHERE);
    const over = maxParticles / lifetime.max * 2;
    refused(() => applyFrame([actor], frame(0, changing({...emitterChange(MODEL_EMITTER_CHANGE.started), rate: over}))),
      MODEL_EMITTER_REFUSAL.overCap(`Frame entity a: emitter ${EMITTER_ID}`, over, lifetime.max, maxParticles));
    assert.equal(visible(), 0);
  });
  it('multiplies a start\'s routed tint into the profile\'s colours, and draws the profile\'s own without one',
  () => {
    const {actor, systems: [{startColor}]} = withEmitters('a', {[EMITTER_ID]: emitterProfile()});
    assert.ok(startColor instanceof ConstantColor, 'the start colour is not a constant');
    const profile = modelEmitterProfile(emitterProfile(), WHERE), [r, g, b] = EMITTER_ROUTED.tint;
    const colors = (tint: Vector4) => [new Vector4(...profile.color).multiply(new Vector4(...profile.tint))
      .multiply(tint)].map(({x, y, z, w}) => [x, y, z, w]);
    const drawn = () => [startColor.color].map(({x, y, z, w}) => [x, y, z, w]);
    applyFrame([actor], frame(0, changing({...emitterChange(MODEL_EMITTER_CHANGE.started), ...EMITTER_ROUTED})));
    assert.deepEqual(drawn(), colors(new Vector4(r, g, b, 1)));
    applyFrame([actor], frame(1, changing(...starting(EMITTER_ID))));
    assert.deepEqual(drawn(), colors(new Vector4(1, 1, 1, 1)));
  });
});
