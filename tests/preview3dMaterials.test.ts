import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelMaterialInspection} from '../src/react/preview3d/materials.ts';
import {MODEL_PREVIEW_MATERIAL_OPTIONS, modelStageMaterialMode} from '../src/react/preview3d/materialModel.ts';

function fixture(material: THREE.Material = new THREE.MeshStandardMaterial()) {
  const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  root.add(mesh);
  return {root, mesh, inspection: createModelMaterialInspection(root)};
}
function shaderFor(material: THREE.Material) {
  const shader = {...THREE.ShaderLib.standard} as Parameters<THREE.Material['onBeforeCompile']>[0];
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader.fragmentShader;
}

describe('material inspection', () => {
  it('validates modes before mutation and preserves source material/array identities', () => {
    for (const option of MODEL_PREVIEW_MATERIAL_OPTIONS) {
      assert.equal(modelStageMaterialMode(option.value), option.value);
    }
    const shared = new THREE.MeshStandardMaterial(), second = new THREE.MeshPhysicalMaterial();
    const original = [shared, second, shared];
    const root = new THREE.Group(), first = new THREE.Mesh(new THREE.BoxGeometry(), original);
    const other = new THREE.Mesh(first.geometry, shared);
    root.add(first, other);
    const inspection = createModelMaterialInspection(root);
    assert.throws(() => inspection.setMode('unknown' as never));
    assert.equal(first.material, original);
    inspection.setMode('color');
    assert.notEqual(first.material, original);
    assert.ok(Array.isArray(first.material));
    assert.equal(first.material[0], first.material[2]);
    assert.equal(first.material[0], other.material);
    const clone = other.material;
    inspection.setMode('color');
    assert.equal(other.material, clone);
    inspection.setMode('lit');
    assert.equal(first.material, original);
    assert.equal(other.material, shared);
    inspection.dispose();
  });

  it('keeps base-map alpha, separate alpha-map, side and geometry references in every mode', () => {
    const map = new THREE.Texture(), alphaMap = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({map, alphaMap, alphaTest: 0.4,
      transparent: true, opacity: 0.7, side: THREE.DoubleSide, vertexColors: true});
    const {mesh, inspection} = fixture(source);
    const geometry = mesh.geometry;
    for (const mode of ['clay', 'color', 'emission'] as const) {
      inspection.setMode(mode);
      const material = mesh.material as THREE.MeshStandardMaterial;
      assert.equal(material.map, map);
      assert.equal(material.alphaMap, alphaMap);
      assert.equal(material.alphaTest, source.alphaTest);
      assert.equal(material.opacity, source.opacity);
      assert.equal(material.transparent, true);
      assert.equal(material.vertexColors, true);
      assert.equal(material.side, THREE.DoubleSide);
      assert.equal(mesh.geometry, geometry);
      const shader = shaderFor(material);
      for (const include of ['map_fragment', 'alphamap_fragment', 'alphatest_fragment', 'color_fragment']) {
        assert.ok(shader.includes(`#include <${include}>`));
      }
    }
    inspection.dispose();
    assert.equal(mesh.material, source);
  });

  it('separates clay shape, unlit source color and emission while preserving the original PBR settings', () => {
    const normal = new THREE.Texture(), color = new THREE.Color(0.2, 0.3, 0.4);
    const source = new THREE.MeshPhysicalMaterial({color, normalMap: normal, roughness: 0.2, metalness: 0.6,
      clearcoat: 1, transmission: 0.4, emissive: 0x33ccaa, emissiveIntensity: 3});
    const {mesh, inspection} = fixture(source);
    inspection.setMode('clay');
    const clay = mesh.material as THREE.MeshPhysicalMaterial;
    assert.equal(clay.normalMap, null);
    assert.equal(clay.clearcoat, 0);
    assert.equal(clay.transmission, 0);
    assert.equal(clay.emissive.getHex(), 0);
    assert.ok(shaderFor(clay).includes('diffuseColor.rgb = diffuse;'));
    inspection.setMode('color');
    const unlit = mesh.material as THREE.MeshStandardMaterial;
    assert.ok(shaderFor(unlit).includes('outgoingLight = diffuseColor.rgb;'));
    assert.equal(unlit.toneMapped, false);
    inspection.setMode('emission');
    const emission = mesh.material as THREE.MeshStandardMaterial;
    assert.ok(shaderFor(emission).includes('outgoingLight = totalEmissiveRadiance;'));
    assert.equal(emission.emissiveIntensity, 3);
    assert.ok(emission.emissive.equals(source.emissive));
    assert.equal(source.normalMap, normal);
    assert.ok(source.color.equals(color));
    assert.equal(source.clearcoat, 1);
    assert.equal(source.transmission, 0.4);
    assert.equal(source.roughness, 0.2);
    assert.equal(source.metalness, 0.6);
    inspection.dispose();
  });

  it('reports configured emission with or without a map, never inventing emission from a map alone', () => {
    const cases = [
      [new THREE.MeshStandardMaterial(), 0],
      [new THREE.MeshStandardMaterial({emissiveMap: new THREE.Texture()}), 0],
      [new THREE.MeshStandardMaterial({emissive: 0x22ffaa}), 1],
      [new THREE.MeshStandardMaterial({emissive: 0x22ffaa, emissiveIntensity: 0}), 0],
      [new THREE.MeshStandardMaterial({emissive: 0x22ffaa, emissiveMap: new THREE.Texture()}), 1],
    ] as const;
    for (const [source, count] of cases) {
      const {inspection} = fixture(source);
      assert.equal(inspection.snapshot().emissiveMaterialCount, count);
      inspection.dispose();
    }
  });

  it('disposes override materials once while leaving borrowed textures and originals to the scene owner', () => {
    const texture = new THREE.Texture(), original = new THREE.MeshStandardMaterial({map: texture});
    let textureDisposals = 0, originalDisposals = 0, cloneDisposals = 0;
    texture.addEventListener('dispose', () => textureDisposals++);
    original.addEventListener('dispose', () => originalDisposals++);
    const {mesh, inspection} = fixture(original);
    inspection.setMode('color');
    (mesh.material as THREE.Material).addEventListener('dispose', () => cloneDisposals++);
    inspection.setMode('clay');
    (mesh.material as THREE.Material).addEventListener('dispose', () => cloneDisposals++);
    inspection.dispose();
    inspection.dispose();
    assert.equal(mesh.material, original);
    assert.deepEqual([textureDisposals, originalDisposals, cloneDisposals], [0, 0, 2]);
    assert.throws(() => inspection.setMode('lit'), /disposed/);
  });

  it('keeps independent model instances isolated and leaves unsupported shaders in their original Lit mode', () => {
    const shared = new THREE.MeshStandardMaterial(), a = fixture(shared), b = fixture(shared);
    a.inspection.setMode('emission');
    assert.equal(b.mesh.material, shared);
    assert.equal(b.inspection.snapshot().materialMode, 'lit');
    const custom = new THREE.MeshStandardMaterial();
    custom.onBeforeCompile = () => {};
    for (const source of [new THREE.ShaderMaterial(), custom]) {
      const {mesh, inspection} = fixture(source);
      assert.equal(inspection.snapshot().materialInspectionAvailable, false);
      assert.throws(() => inspection.setMode('clay'), /does not support/);
      assert.equal(mesh.material, source);
      inspection.setMode('lit');
      inspection.dispose();
    }
    a.inspection.dispose(); b.inspection.dispose();
  });
});
