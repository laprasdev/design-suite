// Each part's own validation throws the stage's one refusal type, before it changes anything.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createModelEnvironment} from '../src/react/preview3d/environment.ts';
import {createModelRuntimeMaterials} from '../src/react/preview3d/runtimeMaterials.ts';
import {createModelMaterialInspection} from '../src/react/preview3d/materials.ts';
import {createModelLighting} from '../src/react/preview3d/lighting.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';

const refused = (run: () => unknown, pattern: RegExp) =>
  assert.throws(run, (error: unknown) => error instanceof ModelStageRefusal && pattern.test(error.message));
const theme = {colors: {stage: '#000000', text: '#ffffff', surface: '#111111', surfaceHi: '#222222',
  accent: '#ff0000', accentDeep: '#880000', teal: '#00ffff'}};

test('environment.ts: an invalid update is a refusal and moves no box', () => {
  const value = {reflectZ: false, plane: null, boxes: [{id: 'box', position: [1, 2, 3], size: [1, 1, 1],
    color: [.5, .5, .5]}]};
  const environment = createModelEnvironment(value);
  const box = environment.group.getObjectByName('box')!;
  refused(() => environment.update({...value, boxes: [{...value.boxes[0], position: [9, 9, 9], color: [2, 0, 0]}]}),
    /sRGB in \[0, 1\]/);
  assert.deepEqual(box.position.toArray(), [1, 2, 3]);
  environment.dispose();
});

test('runtimeMaterials.ts: an unknown renderer is a refusal and installs no material', () => {
  const original = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const materials = createModelRuntimeMaterials([{rendererId: 'body', slot: 0, mesh}]);
  refused(() => materials.prepare([{rendererId: 'ghost', slot: 0, visible: true, colors: {}, floats: {}}]),
    /Unknown or repeated runtime renderer\/slot/);
  assert.equal(mesh.material, original);
  materials.dispose();
});

test('materials.ts: inspection of an unsupported model is a refusal and replaces no material', () => {
  const original = new THREE.MeshBasicMaterial(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const root = new THREE.Group();
  root.add(mesh);
  const inspection = createModelMaterialInspection(root);
  refused(() => inspection.setMode('clay'), /does not support material inspection/);
  assert.equal(mesh.material, original);
  assert.equal(inspection.snapshot().materialMode, 'lit');
});

test('materialModel.ts: an unknown inspection mode is a refusal and leaves the mode', () => {
  const original = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const root = new THREE.Group();
  root.add(mesh);
  const inspection = createModelMaterialInspection(root);
  refused(() => inspection.setMode('xray' as never), /Unknown material inspection mode/);
  assert.equal(mesh.material, original);
});

test('lightingModel.ts: an unknown time is a refusal and leaves the light', () => {
  const lighting = createModelLighting({setClearColor: () => undefined}, theme);
  const before = lighting.lights[0].intensity;
  refused(() => lighting.set({time: 'dusk', times: []}), /The lighting names time dusk/);
  assert.deepEqual([lighting.time, lighting.lights[0].intensity], ['light', before]);
});
