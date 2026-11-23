// A look's tone curve and far plane: checked with the look, then handed to the draw and to the camera as its time
// comes.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelLighting} from '../src/react/preview3d/lighting.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {MODEL_STAGE_TIME, modelStageLighting, type ModelStageTime} from '../src/react/preview3d/lightingModel.ts';
import {MODEL_STAGE_LEAST, MODEL_STAGE_LOOK_FIELDS, MODEL_STAGE_LOOK_REFUSAL, type ModelStageToneCurve}
  from '../src/react/preview3d/lookModel.ts';
import {MODEL_RECORD_REFUSAL} from '../src/react/preview3d/recordModel.ts';
import {modelStageBuiltInTimes} from '../src/react/preview3d/builtInTimes.ts';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';
import {ACES_CURVE, THEME, refused, stageLook} from './preview3dActorFixture.ts';

const DUSK: ModelStageTime = {id: 'dusk', label: 'Dusk',
  look: stageLook({toneCurve: {...ACES_CURVE, exposure: 2.5}, farPlane: 800})};
// What Light and Dark have always drawn under, stated here rather than read back from the times.
const ALWAYS = Object.freeze({toneCurve: ACES_CURVE, farPlane: 100});
const lit = (time: string, times: readonly unknown[]) => modelStageLighting({time, times});
const withLook = (look: object) => () => lit(DUSK.id, [{...DUSK, look: {...DUSK.look, ...look}}]);
const withCurve = (toneCurve: object) => withLook({toneCurve: {...DUSK.look.toneCurve, ...toneCurve}});

describe('a look\'s tone curve and far plane', () => {
  it('reach the draw and the camera with their time; Light and Dark keep what the stage always drew', () => {
    const toneCurves: (ModelStageToneCurve | null)[] = [], farPlanes: number[] = [];
    const lighting = createModelLighting(modelStageBuiltInTimes(THEME.colors), {fog: createModelFog(new THREE.Scene()),
      framing: {setFarPlane: farPlane => {farPlanes.push(farPlane);}}, shared: {setLook: () => undefined},
      output: {load: () => [], prepare: ({toneCurve}) => () => {toneCurves.push(toneCurve);}}});
    lighting.prepare(lit(DUSK.id, [DUSK]))();
    lighting.prepare(lit(MODEL_STAGE_TIME.dark, []))();
    assert.deepEqual(toneCurves, [ALWAYS.toneCurve, DUSK.look.toneCurve, ALWAYS.toneCurve]);
    assert.deepEqual(farPlanes, [ALWAYS.farPlane, DUSK.look.farPlane, ALWAYS.farPlane]);
  });

  it('are refused when the exposure draws nothing, or the far plane is not beyond the near one, by one rule each',
    () => {
    const exposure = MODEL_STAGE_LOOK_REFUSAL.beyond('Time dusk: look.toneCurve.exposure',
      MODEL_STAGE_LEAST.nothing.name);
    for (const value of [-1, 0]) refused(withCurve({exposure: value}), exposure);
    const farPlane = MODEL_STAGE_LOOK_REFUSAL.beyond('Time dusk: look.farPlane', MODEL_STAGE_LEAST.nearPlane.name);
    for (const value of [0, MODEL_STAGE.nearPlane]) refused(withLook({farPlane: value}), farPlane);
    withLook({})();
    refused(withLook({toneCurve: {curve: 'aces-filmic'}}), /look.toneCurve omits exposure/);
    const unstated = Object.fromEntries(Object.entries(DUSK.look).filter(([name]) => name !== 'farPlane'));
    refused(() => lit(DUSK.id, [{...DUSK, look: unstated}]), /look omits farPlane/);
  });

  it('state no exposure without a curve: under none, three scales no light', () => {
    refused(withLook({toneCurve: null, exposure: 2}), MODEL_RECORD_REFUSAL.stray('Time dusk: look', 'exposure',
      MODEL_STAGE_LOOK_FIELDS.look));
  });
});
