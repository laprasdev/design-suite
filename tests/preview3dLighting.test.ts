import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelLighting} from '../src/react/preview3d/lighting.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {MODEL_STAGE_THEME_LIGHTING, MODEL_STAGE_TIME, modelStageBuiltInTimes, modelStageLighting,
  modelStageTimeOptions, type ModelStageTime} from '../src/react/preview3d/lightingModel.ts';
import type {ModelStageTheme} from '../src/react/preview3d/model.ts';

// What Light and Dark set at 62368ac, before the look became data, read from the Three objects themselves.
const recorded = JSON.parse(readFileSync(new URL('./preview3dLighting.fixture.json', import.meta.url), 'utf8'));
const theme: ModelStageTheme = recorded.theme;
function fixture() {
  let clear: THREE.ColorRepresentation = 0;
  const scene = new THREE.Scene();
  const lighting = createModelLighting({setClearColor: color => {clear = color;}}, theme,
    createModelFog(scene, THREE.SRGBColorSpace));
  const floor = new THREE.MeshStandardMaterial();
  lighting.floor(floor);
  const aid = new THREE.MeshBasicMaterial({color: '#ffffff'});
  lighting.attach([new THREE.Mesh(new THREE.BoxGeometry(), aid)]);
  const [ambient, key] = lighting.lights;
  const rgb = (color: THREE.Color) => [color.r, color.g, color.b];
  const read = () => ({backdrop: rgb(new THREE.Color(clear)), ambient: {sky: rgb(ambient.color),
    ground: rgb(ambient.groundColor), intensity: ambient.intensity}, key: {color: rgb(key.color),
    intensity: key.intensity, position: key.position.toArray()}, floor: rgb(floor.color), aid: rgb(aid.color)});
  return {lighting, read, scene};
}
const at = (time: string, times: readonly unknown[] = []) => ({time, times}) as never;
const dusk: ModelStageTime = {id: 'dusk', label: 'Dusk', look: {backdrop: [0.2, 0.1, 0.3],
  key: {color: [1, 0.5, 0], strength: 1.5, direction: [-2, 1, 0]},
  ambient: {sky: [0.4, 0.2, 0.5], ground: [0.1, 0, 0.2], strength: 0.75}, shadow: [0.15, 0.1, 0.25], night: 0.5,
  aids: {floor: [0.3, 0.2, 0.1], share: 0.5}, fog: null}};

describe('stage lighting', () => {
  it('draws Light and Dark with exactly the values they had before the look became data, and no fog', () => {
    const {lighting, read, scene} = fixture();
    assert.equal(lighting.time, MODEL_STAGE_TIME.light);
    assert.deepEqual(read(), recorded.light);
    assert.equal(scene.fog, null);
    lighting.set(at(MODEL_STAGE_TIME.dark));
    assert.deepEqual(read(), recorded.dark);
    lighting.set(MODEL_STAGE_THEME_LIGHTING);
    assert.deepEqual(read(), recorded.light);
  });

  it('applies a time given as data, with no code of its own, and returns to Light exactly', () => {
    const {lighting, read} = fixture();
    lighting.set(at('dusk', [dusk]));
    const linear = (value: readonly number[]) =>
      new THREE.Color().setRGB(value[0], value[1], value[2], THREE.SRGBColorSpace).toArray();
    const {look} = dusk;
    assert.deepEqual(read(), {backdrop: linear(look.backdrop), ambient: {sky: linear(look.ambient.sky),
      ground: linear(look.ambient.ground), intensity: look.ambient.strength}, key: {color: linear(look.key.color),
      intensity: look.key.strength, position: [...look.key.direction]}, floor: linear(look.aids.floor),
      aid: [look.aids.share, look.aids.share, look.aids.share]});
    assert.equal(lighting.time, 'dusk');
    lighting.set(at(MODEL_STAGE_TIME.light, [dusk]));
    assert.deepEqual(read(), recorded.light);
  });

  it('brings a time\'s fog with its look, and takes it away with the next look that has none', () => {
    const {lighting, scene} = fixture();
    const fog = {near: {distance: 4, color: [0.2, 0.1, 0.3]}, far: {distance: 20, color: [0.1, 0.1, 0.2]},
      height: null};
    lighting.set(at('dusk', [{...dusk, look: {...dusk.look, fog}}]));
    assert.ok(scene.fog instanceof THREE.Fog);
    assert.deepEqual([scene.fog.near, scene.fog.far], [4, 20]);
    lighting.set(at(MODEL_STAGE_TIME.dark));
    assert.equal(scene.fog, null);
  });

  it('states where each built-in time sits between day and night, and its shadow colour', () => {
    const [light, dark] = modelStageBuiltInTimes(theme.colors);
    assert.deepEqual([light.look.night, dark.look.night], [0, 1]);
    assert.deepEqual([light.look.shadow, dark.look.shadow], [light.look.ambient.ground, dark.look.ambient.ground]);
  });

  it('refuses an unknown time by name, and leaves the stage as it was', () => {
    const {lighting, read} = fixture();
    assert.throws(() => lighting.set(at('dawn', [dusk])), /names time dawn; the times are light, dark, dusk/);
    assert.equal(lighting.time, MODEL_STAGE_TIME.light);
    assert.deepEqual(read(), recorded.light);
  });

  it('refuses a time that reuses an id, and a look that omits, misnames or misstates a value, by its path', () => {
    assert.throws(() => modelStageLighting(at('dusk', [dusk, dusk])), /Time dusk is declared twice/);
    assert.throws(() => modelStageLighting(at('light', [{...dusk, id: 'dark'}])), /reuses a built-in/);
    const {key, ...keyless} = dusk.look;
    assert.ok(key);
    assert.throws(() => modelStageLighting(at('dusk', [{...dusk, look: keyless}])), /Time dusk: look omits key/);
    assert.throws(() => modelStageLighting(at('dusk', [{...dusk, look: {...dusk.look, haze: 1}}])),
      /Time dusk: look does not state haze/);
    assert.throws(() => modelStageLighting(at('dusk', [{...dusk, look: {...dusk.look, night: 2}}])),
      /Time dusk: look.night must be a finite number from 0 to 1/);
    assert.throws(() => modelStageLighting(at('dusk', [{...dusk, look: {...dusk.look,
      key: {...dusk.look.key, direction: [0, 0, 0]}}}])), /look.key.direction must have a length/);
    assert.throws(() => modelStageLighting({time: 'light'}), /The lighting omits times/);
  });

  it('reads the theme colours Light is made of as #rrggbb, and refuses any other form by name', () => {
    assert.throws(() => createModelLighting({setClearColor: () => undefined},
      {colors: {...theme.colors, surface: 'rgb(1, 2, 3)'}}, {set: () => undefined}),
    /stage theme's surface must be a #rrggbb colour/);
  });

  it('offers the built-in times, then the description\'s own, each with its label', () => {
    assert.deepEqual(modelStageTimeOptions(at('dusk', [dusk])), [{value: 'light', label: 'Light'},
      {value: 'dark', label: 'Dark'}, {value: 'dusk', label: 'Dusk'}]);
  });

  it('gives a floor and aids that join later the look in force, and releases aids to their authored colour', () => {
    const {lighting} = fixture();
    lighting.set(at(MODEL_STAGE_TIME.dark));
    const late = new THREE.MeshStandardMaterial();
    lighting.floor(late);
    assert.deepEqual(late.color.toArray(), recorded.dark.floor);
    const joint = new THREE.MeshBasicMaterial({color: '#ffffff'});
    const lit = new THREE.MeshStandardMaterial({color: '#ffffff'});
    const release = lighting.attach([new THREE.Mesh(new THREE.SphereGeometry(), joint),
      new THREE.Mesh(new THREE.BoxGeometry(), lit)]);
    assert.deepEqual(joint.color.toArray(), recorded.dark.aid);
    assert.deepEqual(lit.color.toArray(), [1, 1, 1]);
    release();
    lighting.set(at(MODEL_STAGE_TIME.light));
    lighting.set(at(MODEL_STAGE_TIME.dark));
    assert.deepEqual(joint.color.toArray(), [1, 1, 1]);
    assert.deepEqual(late.color.toArray(), recorded.dark.floor);
  });
});
