import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelMaterialInspection, createModelSurfaceModes, modelStageChanges}
  from '../src/react/preview3d/materials.ts';
import {MODEL_PREVIEW_SURFACE_SETTINGS, modelStageSurfaceMode} from '../src/react/preview3d/surfaceModeModel.ts';
import {extendModelMaterial, extendModelMaterials, modelMaterialChanges, type ModelShader}
  from '../src/react/preview3d/shading.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';

// A file's material as the stage holds it, with the Surface modes; and its program as three would hand it over for a
// material with a base colour map, an occlusion map, a normal map and an emissive map, fogged, under a tone curve.
function fixture(material: THREE.Material = new THREE.MeshStandardMaterial()) {
  const modes = createModelSurfaceModes(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  extendModelMaterial(material, [modes.change]);
  return {modes, mesh, material};
}
// The materials of a model with no kind: none is a kind's.
const NO_KIND = () => false;
const MAPS = Object.freeze({map: true, aoMap: true, normalMap: true, normalMapTangentSpace: true, emissiveMap: true,
  roughnessMap: true, clearcoat: true, fog: true, toneMapping: THREE.ACESFilmicToneMapping});
function compiled(material: THREE.Material, lib: 'standard' | 'physical' | 'basic' | 'points' = 'standard') {
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
    const inspection = createModelMaterialInspection(() => [mesh.material], NO_KIND), version = material.version;
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
    for (const line of [
      `#include <roughnessmap_fragment>\nroughnessFactor = ${MODEL_PREVIEW_SURFACE_SETTINGS.roughness}.0;`,
      `#include <metalnessmap_fragment>\nmetalnessFactor = ${MODEL_PREVIEW_SURFACE_SETTINGS.metalness}.0;`,
      '#include <emissivemap_fragment>\ndiffuseColor.rgb = modelSurfaceClay;\ntotalEmissiveRadiance = vec3( 0.0 );',
      'uniform vec3 modelSurfaceClay;']) {
      assert.ok(source.includes(line), line);
    }
    assert.deepEqual((clay.uniforms.modelSurfaceClay.value as THREE.Color).toArray(),
      new THREE.Color().setHex(MODEL_PREVIEW_SURFACE_SETTINGS.clayColor).toArray());
    // A physical material's specular intensity is held at 0; only a physical program defines IOR and USE_SPECULAR.
    assert.match(source, /#include <lights_physical_fragment>\n\n#if defined\( IOR \) && defined\( USE_SPECULAR \)\n/);
    assert.match(source, /vec3\( 1\.0 \) \) \* 0\.0, diffuseColor\.rgb, metalnessFactor \);/);
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

  it('covers the programs three compiles as STANDARD; a line, points or an unlit mesh is drawn as stated in every mode',
    () => {
      const modes = createModelSurfaceModes(), fog = createModelFog(new THREE.Scene()), shape = new THREE.BoxGeometry();
      const standard = new THREE.MeshStandardMaterial(), physical = new THREE.MeshPhysicalMaterial();
      const unlit = new THREE.MeshBasicMaterial(), line = new THREE.LineBasicMaterial();
      const points = new THREE.PointsMaterial();
      const root = new THREE.Group();
      root.add(new THREE.Mesh(shape, standard), new THREE.Mesh(shape, [physical, unlit]), new THREE.Line(shape, line),
        new THREE.Points(shape, points));
      extendModelMaterials(root, modelStageChanges(fog.change, modes));
      const keys = (material: THREE.Material) => modelMaterialChanges(material).map(({key}) => key);
      for (const material of [standard, physical]) {
        assert.deepEqual(keys(material), ['model-stage-fog', 'model-surface-mode:lit']);
      }
      for (const material of [unlit, line, points]) assert.deepEqual(keys(material), ['model-stage-fog']);
      const programs = [[standard, 'standard'], [physical, 'physical'], [unlit, 'basic'], [line, 'basic'],
        [points, 'points']] as const;
      for (const mode of ['clay', 'color', 'emission'] as const) {
        modes.set(mode);
        for (const [material, lib] of programs) {
          const shader = compiled(material, lib);
          const written = /modelSurfaceClay|outgoingLight = \w+(\.rgb)?;\n#include <opaque_fragment>/;
          const changed = written.test(shader.fragmentShader);
          assert.equal(changed, lib === 'standard' || lib === 'physical', `${mode} on ${lib}`);
          assert.equal(shader.fog, !changed, `${mode} on ${lib}: fog as stated`);
        }
      }
      // A line or points is no surface: only the meshes' materials say whether the modes are available.
      assert.equal(createModelMaterialInspection(() => [standard, physical], NO_KIND).available, true);
      assert.equal(createModelMaterialInspection(() => [standard, unlit], NO_KIND).available, false);
    });

  it('reports configured emission, never inventing it from a map alone, and which models can show the modes', () => {
    const count = (material: THREE.Material) =>
      createModelMaterialInspection(() => [fixture(material).material], NO_KIND);
    assert.equal(count(new THREE.MeshStandardMaterial({emissive: 0xff0000})).emissiveMaterialCount, 1);
    assert.equal(count(new THREE.MeshStandardMaterial({emissiveMap: new THREE.Texture()})).emissiveMaterialCount, 0);
    assert.equal(count(new THREE.MeshStandardMaterial({emissive: 0xff0000, emissiveIntensity: 0}))
      .emissiveMaterialCount, 0);
    assert.equal(count(new THREE.MeshStandardMaterial()).available, true);
    assert.equal(count(new THREE.MeshBasicMaterial()).available, false);
    const foreign = new THREE.MeshStandardMaterial();
    foreign.onBeforeCompile = () => undefined;
    assert.equal(createModelMaterialInspection(() => [foreign], NO_KIND).available, false);
    assert.equal(createModelMaterialInspection(() => [], NO_KIND).available, false);
    // A kind's material on three's standard program can show every mode, and counts as emitting: its program computes
    // its emission. One on another program (an unlit kind's) cannot.
    const kind = new THREE.ShaderMaterial({defines: {STANDARD: ''}}), unlit = new THREE.ShaderMaterial();
    const withKind = createModelMaterialInspection(() => [kind, kind], material => material === kind);
    assert.deepEqual([withKind.available, withKind.emissiveMaterialCount], [true, 1]);
    assert.equal(createModelMaterialInspection(() => [unlit], material => material === unlit).available, false);
    assert.throws(() => modelStageSurfaceMode('xray'), /The stage description.surfaceMode is one of lit, clay/);
  });
});
