import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {createModelRuntimeMaterials, MODEL_RUNTIME_MATERIAL as channel}
  from '../src/react/preview3d/runtimeMaterials.ts';
import {createModelFog, MODEL_FOG_CHANGE} from '../src/react/preview3d/fog.ts';
import {extendModelMaterial, modelMaterialChanges} from '../src/react/preview3d/shading.ts';

const rendererId = 'body';
const output = (changes = {}) => ({rendererId, slot: 0, visible: true, colors: {}, floats: {}, ...changes});
function fixture() {
  const texture = new THREE.Texture();
  // A file's material as the actor hands it over: already carrying the stage's fog.
  const original = extendModelMaterial(new THREE.MeshStandardMaterial({map: texture, color: 0xeeeeee}),
    [createModelFog(new THREE.Scene()).change]);
  const first = new THREE.Mesh(new THREE.BoxGeometry(), original);
  const second = new THREE.Mesh(first.geometry, original);
  const materials = createModelRuntimeMaterials([{rendererId, slot: 0, mesh: first}]);
  return {texture, original, first, second, materials};
}
test('runtime output owns a clone, decodes sRGB once and keeps HDR intensity', () => {
  const {original, first, second, texture, materials} = fixture();
  materials.prepare([output({colors: {[channel.color]: [.55, .65, .8, 1],
    [channel.emissionColor]: [.65, .8, 1, 1]}, floats: {[channel.emissionStrength]: 2.8}})])();
  const applied = first.material as THREE.MeshStandardMaterial;
  assert.notEqual(applied, original);
  assert.equal(second.material, original);
  assert.equal(applied.map, texture);
  assert.equal(applied.emissiveIntensity, 2.8);
  assert.deepEqual(applied.color.toArray(), new THREE.Color().setRGB(.55, .65, .8, THREE.SRGBColorSpace).toArray());
  assert.deepEqual(applied.emissive.toArray(), new THREE.Color().setRGB(.65, .8, 1, THREE.SRGBColorSpace).toArray());
  const shader = {uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader};
  applied.onBeforeCompile(shader as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  assert.match(shader.fragmentShader, /totalEmissiveRadiance \*= diffuseColor\.rgb/);
  // The copy compiles what the original does, the stage's fog first, and then tints its emission.
  assert.deepEqual(modelMaterialChanges(applied).map(({key}) => key), [MODEL_FOG_CHANGE, channel.profile]);
  assert.equal(applied.customProgramCacheKey(), `${MODEL_FOG_CHANGE} ${channel.profile}`);
  assert.match(shader.fragmentShader, /modelStageFogFarColor/);
  materials.dispose();
});
test('empty maps, omission, reset and disposal restore exact references and do not dispose borrowed textures', () => {
  const {original, first, texture, materials} = fixture();
  let textureDisposals = 0, cloneDisposals = 0;
  texture.addEventListener('dispose', () => textureDisposals++);
  const apply = () => materials.prepare([output({floats: {[channel.emissionStrength]: 3}})])();
  apply();
  const clone = first.material as THREE.MeshStandardMaterial;
  clone.addEventListener('dispose', () => cloneDisposals++);
  materials.prepare([output()])(); assert.equal(first.material, original);
  apply(); materials.prepare([])(); assert.equal(first.material, original);
  apply(); materials.reset(); assert.equal(first.material, original);
  apply(); materials.dispose(); materials.dispose();
  assert.equal(first.material, original);
  assert.equal(cloneDisposals, 1); assert.equal(textureDisposals, 0);
  assert.throws(() => materials.prepare([]), /disposed/);
});
test('a malformed later renderer leaves the entire previous update intact', () => {
  const {materials, first} = fixture();
  materials.prepare([output({floats: {[channel.emissionStrength]: .4}})])();
  const prior = first.material;
  assert.throws(() => materials.prepare([output({visible: false}), output({rendererId: 'missing'})]), /Unknown/);
  assert.equal(first.material, prior); assert.equal(first.visible, true);
  assert.equal((prior as THREE.MeshStandardMaterial).emissiveIntensity, .4);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.throws(() => materials.prepare([output({floats: {[channel.emissionStrength]: invalid}})]), /nonfinite/);
  }
  assert.throws(() => materials.prepare([output({colors: {[channel.color]: [1, 1, 1, .5]}})]), /opaque alpha/);
  assert.throws(() => materials.prepare([output(), output()]), /repeated/);
  materials.dispose();
});
test('caller mutation and stale preparation cannot change an accepted update', () => {
  const {materials, first} = fixture();
  const source = [output({colors: {[channel.color]: [.2, .4, .6, 1]}})];
  const prepared = materials.prepare(source);
  source[0].colors = {[channel.color]: [1, 0, 0, 1]};
  prepared();
  assert.deepEqual((first.material as THREE.MeshStandardMaterial).color.toArray(),
    new THREE.Color().setRGB(.2, .4, .6, THREE.SRGBColorSpace).toArray());
  assert.throws(prepared, /stale/);
  const pending = materials.prepare([]);
  materials.reset(); assert.throws(pending, /stale/);
  materials.dispose();
});
test('multi-slot renderers retain their array and require consistent visibility', () => {
  const original = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
  mesh.visible = false;
  const materials = createModelRuntimeMaterials([0, 1].map(slot => ({rendererId, slot, mesh})));
  assert.throws(() => materials.prepare([output({visible: false}), output({slot: 1})]), /visibility/);
  const shown = materials.prepare([output({floats: {[channel.emissionStrength]: .4}}),
    output({slot: 1, floats: {[channel.emissionStrength]: .6}})])();
  assert.notEqual(mesh.material[0], original[0]); assert.notEqual(mesh.material[1], original[1]);
  assert.deepEqual([...shown], []);
  // The outputs' visibility is handed back as data; the mesh's own visibility belongs to its actor.
  const hidden = materials.prepare([output({visible: false}), output({slot: 1, visible: false})])();
  assert.deepEqual([[...hidden], mesh.visible], [[mesh], false]);
  mesh.visible = true;
  assert.deepEqual([[...materials.reset()], mesh.material, mesh.visible], [[], original, true]);
  materials.dispose();
});
test('sparse color arrays cannot replace a previously accepted material', () => {
  const {materials, first} = fixture();
  materials.prepare([output({floats: {[channel.emissionStrength]: .4}})])();
  const previous = first.material, sparse = new Array(4); sparse[3] = 1;
  assert.throws(() => materials.prepare([output({colors: {[channel.color]: sparse}})]), /opaque alpha/);
  assert.equal(first.material, previous);
  assert.equal((first.material as THREE.MeshStandardMaterial).emissiveIntensity, .4);
  materials.dispose();
});
