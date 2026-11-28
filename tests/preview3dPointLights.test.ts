// A look's point lights: checked with the look, held to the stage's budget, and drawn by the stage's lighting.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelLighting} from '../src/react/preview3d/lighting.ts';
import {modelStageLighting} from '../src/react/preview3d/lightingModel.ts';
import {modelStageBuiltInTimes} from '../src/react/preview3d/builtInTimes.ts';
import {MODEL_STAGE_ABOVE, MODEL_STAGE_LIGHT_BUDGET, MODEL_STAGE_LOOK_REFUSAL, type ModelStagePointLight}
  from '../src/react/preview3d/lookModel.ts';
import {lookLayers, refused, stageLook} from './preview3dActorFixture.ts';

const THEME = Object.freeze({stage: '#101820', text: '#e0e8f0', surface: '#304050'});
const LAVA: ModelStagePointLight = {color: [1, 0.4, 0.1], strength: 260, range: 40, position: [7, 2.2, -14]};
const CAVE: ModelStagePointLight = {color: [0, 0.9, 0.9], strength: 70, range: 11, position: [0, 3, -59]};
const lit = (lights: unknown) => () =>
  modelStageLighting({time: 'glow', times: [{id: 'glow', label: 'Glow', look: {...stageLook(), lights}}]});
const WHERE = 'Time glow: look.lights';

describe('a look\'s point lights', () => {
  it('are a list of whole lights, none an empty one, each refused by name where it is not a light', () => {
    assert.deepEqual(lit([LAVA, CAVE])().times[0].look.lights, [LAVA, CAVE]);
    assert.deepEqual(lit([])().times[0].look.lights, []);
    refused(lit(null), MODEL_STAGE_LOOK_REFUSAL.lights(WHERE));
    const range = MODEL_STAGE_LOOK_REFUSAL.beyond(`${WHERE}[1].range`, MODEL_STAGE_ABOVE.nothing().name);
    for (const value of [0, -1]) refused(lit([LAVA, {...CAVE, range: value}]), range);
    refused(lit([{...LAVA, strength: -1}]), /look\.lights\[0\]\.strength/);
    const {position: _, ...unplaced} = LAVA;
    refused(lit([unplaced]), /look\.lights\[0\] omits position/);
  });

  it('are refused whole past the stage\'s budget, saying by how many', () => {
    const full = Array.from({length: MODEL_STAGE_LIGHT_BUDGET.pointLights}, () => LAVA);
    assert.equal(lit(full)().times[0].look.lights.length, MODEL_STAGE_LIGHT_BUDGET.pointLights);
    refused(lit([...full, CAVE, CAVE]), MODEL_STAGE_LOOK_REFUSAL.overBudget(WHERE, full.length + 2));
    assert.match(MODEL_STAGE_LOOK_REFUSAL.overBudget(WHERE, full.length + 2), /, 2 over the stage's budget of /);
  });

  it('are drawn as stated, the rest of the budget hidden, and hidden again by a look with none', () => {
    const lighting = createModelLighting(modelStageBuiltInTimes(THEME), lookLayers());
    const points = lighting.lights.filter((light): light is THREE.PointLight => light instanceof THREE.PointLight);
    assert.equal(points.length, MODEL_STAGE_LIGHT_BUDGET.pointLights);
    const shown = () => points.filter(light => light.visible).map(light => ({
      color: [light.color.r, light.color.g, light.color.b], strength: light.intensity, range: light.distance,
      position: light.position.toArray(), decay: light.decay}));
    assert.deepEqual(shown(), []);
    lighting.prepare(lit([LAVA, CAVE])())();
    const linear = ({color}: ModelStagePointLight) =>
      new THREE.Color().setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace).toArray();
    // Decay 2 with a range is three's inverse square windowed to nothing at the range, URP's point attenuation.
    assert.deepEqual(shown(), [LAVA, CAVE].map(light => ({color: linear(light), strength: light.strength,
      range: light.range, position: [...light.position], decay: 2})));
    lighting.prepare(lit([])())();
    assert.deepEqual(shown(), []);
  });
});
