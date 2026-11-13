import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelLighting} from '../src/react/preview3d/lighting.ts';
import {MODEL_PREVIEW_LIGHTING_OPTIONS as OPTIONS, MODEL_STAGE_DARK} from '../src/react/preview3d/lightingModel.ts';
import {modelStageLighting} from '../src/react/preview3d/lightingModel.ts';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';
import type {ModelStageTheme} from '../src/react/preview3d/model.ts';

const theme: ModelStageTheme = {colors: {
  stage: '#101014', text: '#f2e9ff', surface: '#1b1b22', surfaceHi: '#2a2a33',
  accent: '#d05fa2', accentDeep: '#7a2f5c', teal: '#3fb6a8',
}};
function fixture() {
  const cleared: THREE.ColorRepresentation[] = [];
  const lighting = createModelLighting({setClearColor: color => {cleared.push(color);}}, theme);
  const [ambient, key] = lighting.lights;
  return {lighting, ambient, key, backdrop: () => new THREE.Color(cleared.at(-1)).getHex()};
}
const hex = (value: THREE.ColorRepresentation) => new THREE.Color(value).getHex();

describe('stage lighting', () => {
  it('accepts its own options and refuses anything else before changing the stage', () => {
    for (const option of OPTIONS) assert.equal(modelStageLighting(option.value), option.value);
    const {lighting, backdrop} = fixture();
    assert.throws(() => lighting.set('dusk' as never), /Unknown stage lighting/);
    assert.equal(lighting.mode, 'light');
    assert.equal(backdrop(), hex(theme.colors.stage));
  });

  it('starts in Light as the theme alone lit the stage: its backdrop, both light colours and both strengths', () => {
    const {lighting, ambient, key, backdrop} = fixture();
    assert.equal(lighting.mode, 'light');
    assert.equal(backdrop(), hex(theme.colors.stage));
    assert.equal(ambient.color.getHex(), hex(theme.colors.text));
    assert.equal(ambient.groundColor.getHex(), hex(theme.colors.surface));
    assert.equal(ambient.intensity, MODEL_STAGE.ambientIntensity);
    assert.equal(key.color.getHex(), hex(theme.colors.text));
    assert.equal(key.intensity, MODEL_STAGE.lightIntensity);
    assert.deepEqual(key.position.toArray(), [...MODEL_STAGE.keyLightPosition]);
  });

  it('takes Dark from its own settings, dims the lights rather than the exposure, and returns to Light exactly', () => {
    const {lighting, ambient, key, backdrop} = fixture();
    lighting.set('dark');
    assert.equal(lighting.mode, 'dark');
    assert.equal(backdrop(), MODEL_STAGE_DARK.backdrop);
    assert.equal(ambient.color.getHex(), MODEL_STAGE_DARK.light);
    assert.equal(ambient.groundColor.getHex(), MODEL_STAGE_DARK.backdrop);
    assert.equal(key.color.getHex(), MODEL_STAGE_DARK.light);
    assert.equal(ambient.intensity, MODEL_STAGE.ambientIntensity * MODEL_STAGE_DARK.lightShare);
    assert.equal(key.intensity, MODEL_STAGE.lightIntensity * MODEL_STAGE_DARK.lightShare);
    assert.ok(MODEL_STAGE_DARK.lightShare > 0 && MODEL_STAGE_DARK.lightShare < 1);
    lighting.set('light');
    assert.equal(backdrop(), hex(theme.colors.stage));
    assert.equal(ambient.color.getHex(), hex(theme.colors.text));
    assert.equal(ambient.groundColor.getHex(), hex(theme.colors.surface));
    assert.equal(ambient.intensity, MODEL_STAGE.ambientIntensity);
    assert.equal(key.intensity, MODEL_STAGE.lightIntensity);
  });

  it('gives the lit floor the theme surface in Light and its own colour in Dark, whenever it joins', () => {
    const {lighting} = fixture();
    const early = new THREE.MeshStandardMaterial();
    lighting.floor(early);
    assert.equal(early.color.getHex(), hex(theme.colors.surface));
    lighting.set('dark');
    const late = new THREE.MeshStandardMaterial();
    lighting.floor(late);
    assert.equal(early.color.getHex(), MODEL_STAGE_DARK.floor);
    assert.equal(late.color.getHex(), MODEL_STAGE_DARK.floor);
    lighting.set('light');
    assert.equal(early.color.getHex(), hex(theme.colors.surface));
    assert.equal(late.color.getHex(), hex(theme.colors.surface));
  });

  it('holds unlit stage aids to their share in Dark, whenever they join, and leaves lit materials alone', () => {
    const {lighting} = fixture();
    const grid = new THREE.GridHelper(2, 2, '#804020', '#204080');
    const joint = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial({color: '#ffffff'}));
    const lit = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({color: '#ffffff'}));
    const root = new THREE.Group();
    root.add(joint, lit);
    lighting.attach([grid]);
    lighting.set('dark');
    const release = lighting.attach([root]);
    const share = MODEL_STAGE_DARK.aidShare;
    assert.deepEqual((grid.material as THREE.LineBasicMaterial).color.toArray(), [share, share, share]);
    assert.deepEqual((joint.material as THREE.MeshBasicMaterial).color.toArray(), [share, share, share]);
    assert.deepEqual((lit.material as THREE.MeshStandardMaterial).color.toArray(), [1, 1, 1]);
    lighting.set('light');
    assert.deepEqual((grid.material as THREE.LineBasicMaterial).color.toArray(), [1, 1, 1]);
    assert.deepEqual((joint.material as THREE.MeshBasicMaterial).color.toArray(), [1, 1, 1]);
    lighting.set('dark');
    release();
    assert.deepEqual((joint.material as THREE.MeshBasicMaterial).color.toArray(), [1, 1, 1]);
    lighting.set('light');
    lighting.set('dark');
    assert.deepEqual((joint.material as THREE.MeshBasicMaterial).color.toArray(), [1, 1, 1]);
    assert.deepEqual((grid.material as THREE.LineBasicMaterial).color.toArray(), [share, share, share]);
  });
});
