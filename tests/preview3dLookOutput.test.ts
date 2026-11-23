// A look's tone curve and far plane, checked with the look; the lighting's tests follow them to the draw and the
// camera.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelStageLighting, type ModelStageTime} from '../src/react/preview3d/lightingModel.ts';
import {MODEL_STAGE_ABOVE, MODEL_STAGE_CURVE, MODEL_STAGE_LOOK_FIELDS, MODEL_STAGE_LOOK_REFUSAL}
  from '../src/react/preview3d/lookModel.ts';
import {MODEL_RECORD_REFUSAL} from '../src/react/preview3d/recordModel.ts';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';
import {ACES_CURVE, refused, stageLook} from './preview3dActorFixture.ts';

const DUSK: ModelStageTime = {id: 'dusk', label: 'Dusk',
  look: stageLook({toneCurve: {...ACES_CURVE, exposure: 2.5}, farPlane: 800})};
const lit = (time: string, times: readonly unknown[]) => modelStageLighting({time, times});
const withLook = (look: object) => () => lit(DUSK.id, [{...DUSK, look: {...DUSK.look, ...look}}]);
const withCurve = (toneCurve: object) => withLook({toneCurve: {...DUSK.look.toneCurve, ...toneCurve}});

describe('a look\'s tone curve and far plane', () => {
  it('are refused when the exposure draws nothing, or the far plane is not beyond the near one, by one rule each',
    () => {
    const exposure = MODEL_STAGE_LOOK_REFUSAL.beyond('Time dusk: look.toneCurve.exposure',
      MODEL_STAGE_ABOVE.nothing().name);
    for (const value of [-1, 0]) refused(withCurve({exposure: value}), exposure);
    const farPlane = MODEL_STAGE_LOOK_REFUSAL.beyond('Time dusk: look.farPlane', MODEL_STAGE_ABOVE.nearPlane().name);
    for (const value of [0, MODEL_STAGE.nearPlane]) refused(withLook({farPlane: value}), farPlane);
    withLook({})();
    refused(withLook({toneCurve: {curve: ACES_CURVE.curve}}), /look.toneCurve omits exposure/);
    const unstated = Object.fromEntries(Object.entries(DUSK.look).filter(([name]) => name !== 'farPlane'));
    refused(() => lit(DUSK.id, [{...DUSK, look: unstated}]), /look omits farPlane/);
  });

  it('take a curve with a glow (the output pass applies the curve after the bloom), and no other curve', () => {
    const glow = {threshold: 1, strength: 1, radius: 0};
    assert.deepEqual(withLook({glow})().times[0].look.toneCurve, DUSK.look.toneCurve);
    refused(withLook({glow, toneCurve: {...DUSK.look.toneCurve, curve: 'reinhard'}}),
      MODEL_RECORD_REFUSAL.option('Time dusk: look.toneCurve.curve', Object.values(MODEL_STAGE_CURVE)));
  });

  it('state no exposure without a curve: under none, three scales no light', () => {
    refused(withLook({toneCurve: null, exposure: 2}), MODEL_RECORD_REFUSAL.stray('Time dusk: look', 'exposure',
      MODEL_STAGE_LOOK_FIELDS.look));
  });
});
