import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelMaterialInspection, createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {MODEL_PREVIEW_MATERIAL_SETTINGS, modelStageMaterialMode} from '../src/react/preview3d/materialModel.ts';
import {extendModelMaterial, type ModelShader} from '../src/react/preview3d/shading.ts';

// A file's material as the stage holds it, with the Surface modes; and its program as three would hand it over for a
// material with a base colour map, an occlusion map, a normal map and an emissive map, fogged, under a tone curve.
function fixture(material: THREE.Material = new THREE.MeshStandardMaterial()) {
  const modes = createModelSurfaceModes(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  extendModelMaterial(material, [modes.change]);
  return {modes, mesh, material};
}
const MAPS = Object.freeze({map: true, aoMap: true, normalMap: true, normalMapTangentSpace: true, emissiveMap: true,
  roughnessMap: true, clearcoat: true, fog: true, toneMapping: THREE.ACESFilmicToneMapping});
function compiled(material: THREE.Material, lib: 'standard' | 'physical' = 'standard') {
  const shader = {...THREE.ShaderLib[lib], ...MAPS, uniforms: {}} as unknown as ModelShader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('the Surface modes', () => {
  it('are one change on the same material: Lit changes nothing, and each mode is its own program key', () => {
    const {modes, mesh, material} = fixture();
    const lit = compiled(material);
    assert.deepEqual([lit.fragmentShader, lit.vertexShader, lit.fog, lit.normalMap],
      [THREE.ShaderLib.standard.fragmentShader, THREE.ShaderLib.standard.vertexShader, true, true]);
    assert.equal(material.customProgramCacheKey(), 'model-surface-mode:lit');
    for (const mode of ['clay', 'color', 'emission', 'lit'] as const) {
      modes.set(mode);
      assert.equal(material.customProgramCacheKey(), `model-surface-mode:${mode}`);
      assert.equal(mesh.material, material, 'no copy is ever drawn in its place');
    }
    const inspection = createModelMaterialInspection(mesh), version = material.version;
    inspection.refresh();
    assert.equal(material.version, version + 1, 'a mode change has the material take its program again');
  });

  it('shows Clay: the shape in a neutral colour and finish, the base colour\'s alpha kept, nothing else of it', () => {
    const {modes, material} = fixture();
    modes.set('clay');
    const clay = compiled(material);
    assert.deepEqual([clay.map, clay.aoMap, clay.normalMap, clay.normalMapTangentSpace, clay.emissiveMap,
      clay.roughnessMap, clay.clearcoat, clay.fog, clay.toneMapping],
    [true, false, false, false, false, false, false, false, THREE.ACESFilmicToneMapping]);
    const source = clay.fragmentShader;
    for (const line of ['#include <color_fragment>\ndiffuseColor.rgb = modelSurfaceClay;',
      `#include <roughnessmap_fragment>\nroughnessFactor = ${MODEL_PREVIEW_MATERIAL_SETTINGS.roughness}.0;`,
      `#include <metalnessmap_fragment>\nmetalnessFactor = ${MODEL_PREVIEW_MATERIAL_SETTINGS.metalness}.0;`,
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance = vec3( 0.0 );', 'uniform vec3 modelSurfaceClay;']) {
      assert.ok(source.includes(line), line);
    }
    assert.deepEqual((clay.uniforms.modelSurfaceClay.value as THREE.Color).toArray(),
      new THREE.Color().setHex(MODEL_PREVIEW_MATERIAL_SETTINGS.clayColor).toArray());
    // A physical material's specular intensity is held at 0; only a physical program defines IOR and USE_SPECULAR.
    assert.match(source, /#include <lights_physical_fragment>\n\n#if defined\( IOR \) && defined\( USE_SPECULAR \)\n/);
    assert.match(source, /material\.specularF90 = mix\( 0\.0, 1\.0, metalnessFactor \);/);
  });

  it('shows Color untoned and Emission as it is, both without fog, through three\'s own output', () => {
    const {modes, material} = fixture();
    modes.set('color');
    const color = compiled(material);
    assert.ok(color.fragmentShader.includes('outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>'));
    assert.ok(!color.fragmentShader.includes('#include <tonemapping_fragment>'));
    // The curve is left out of the program, never switched off in three's parameters, which it compares per frame.
    assert.deepEqual([color.fog, color.toneMapping, color.normalMap], [false, THREE.ACESFilmicToneMapping, true]);
    modes.set('emission');
    const emission = compiled(material);
    assert.ok(emission.fragmentShader.includes('outgoingLight = totalEmissiveRadiance;\n#include <opaque_fragment>'));
    assert.ok(emission.fragmentShader.includes('#include <tonemapping_fragment>'));
    assert.deepEqual([emission.fog, emission.emissiveMap], [false, true]);
  });

  it('reports configured emission, never inventing it from a map alone, and which models can show the modes', () => {
    const count = (material: THREE.Material) => createModelMaterialInspection(fixture(material).mesh);
    assert.equal(count(new THREE.MeshStandardMaterial({emissive: 0xff0000})).emissiveMaterialCount, 1);
    assert.equal(count(new THREE.MeshStandardMaterial({emissiveMap: new THREE.Texture()})).emissiveMaterialCount, 0);
    assert.equal(count(new THREE.MeshStandardMaterial({emissive: 0xff0000, emissiveIntensity: 0}))
      .emissiveMaterialCount, 0);
    assert.equal(count(new THREE.MeshStandardMaterial()).available, true);
    assert.equal(count(new THREE.MeshBasicMaterial()).available, false);
    const foreign = new THREE.MeshStandardMaterial();
    foreign.onBeforeCompile = () => undefined;
    assert.equal(createModelMaterialInspection(new THREE.Mesh(new THREE.BoxGeometry(), foreign)).available, false);
    assert.equal(createModelMaterialInspection(new THREE.Group()).available, false);
    assert.throws(() => modelStageMaterialMode('xray'), /Unknown material inspection mode/);
  });
});
