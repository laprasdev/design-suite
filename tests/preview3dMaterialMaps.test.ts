import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {ModelStageRefusal, modelActorMaterialMaps, modelStagePolicy} from '../src/react/preview3d/model.ts';
import {createModelActorMaterialMaps} from '../src/react/preview3d/actorMaterialMaps.ts';
import {applyModelActorMaterialMaps, createModelActor} from '../src/react/preview3d/actor.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {createModelSurfaceModes, modelStageChanges} from '../src/react/preview3d/materials.ts';
import {extendModelMaterials, modelMaterialChanges, modelMaterialOwned} from '../src/react/preview3d/shading.ts';
import {createModelStageDescriptions} from '../src/react/preview3d/stageDescriptions.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {THEME, actorContext, declaration, describing, refused} from './preview3dActorFixture.ts';
import {MASK, PULSE, PULSE_PROGRAM, kindFile, kinds, record, RENDERERS} from './preview3dKindFixture.ts';
import {TERRAIN_ID, terrainActor} from './preview3dTerrainFixture.ts';

const fakeImage = (label: string) => ({label, width: 16, height: 16});
const validMaps = (value: unknown) => {
  const checked = modelActorMaterialMaps(value, 'test');
  assert.ok(checked !== null);
  return checked;
};
const standardMaterial = (mesh: THREE.Mesh) => {
  assert.ok(mesh.material instanceof THREE.MeshStandardMaterial);
  return mesh.material;
};
const trackDispose = (target: {addEventListener(type: 'dispose', listener: () => void): void}) => {
  let count = 0;
  target.addEventListener('dispose', () => count++);
  return () => count;
};

describe('modelActorMaterialMaps validation', () => {
  it('accepts null, empty record, and valid entries while freezing records without freezing images', () => {
    assert.equal(modelActorMaterialMaps(null, 'maps'), null);
    const empty = validMaps({});
    assert.deepEqual(empty, {});
    assert.ok(Object.isFrozen(empty));
    const img = fakeImage('a'), tint = [0.2, 0.5, 0.8];
    const parsed = validMaps({Body: {image: img}, Trim: {image: img, colorSpace: 'linear', flipY: true, color: tint}});
    tint[0] = 1;
    assert.equal(parsed.Body.image, img);
    assert.equal('colorSpace' in parsed.Body, false);
    assert.equal(Object.isFrozen(img), false, 'caller image object stays mutable');
    assert.ok(Object.isFrozen(parsed) && Object.isFrozen(parsed.Trim) && Object.isFrozen(parsed.Trim.color));
    assert.deepEqual(parsed.Trim, {image: img, colorSpace: 'linear', flipY: true, color: [0.2, 0.5, 0.8]});
  });

  it('refuses invalid records, empty names, bad images, bad optional fields and stray keys', () => {
    for (const bad of [undefined, 42, 'body', true, []]) refused(() => modelActorMaterialMaps(bad, 'maps'));
    refused(() => modelActorMaterialMaps({'': {image: fakeImage('x')}}, 'maps'), /non-empty string/);
    for (const image of [null, undefined, 'img', 7, false, []]) {
      refused(() => modelActorMaterialMaps({Body: {image}}, 'maps'), /image/);
    }
    const img = fakeImage('x');
    for (const entry of [null, [], {}, {image: img, extra: 1}, {image: img, colorSpace: undefined},
      {image: img, colorSpace: 'p3'}, {image: img, flipY: undefined}, {image: img, flipY: 1},
      {image: img, color: undefined}, {image: img, color: [1, 2, 0]}, {image: img, color: [0.5, NaN, 0.5]}]) {
      refused(() => modelActorMaterialMaps({Body: entry}, 'maps'));
    }
  });
});

describe('createModelActorMaterialMaps runtime lifecycle', () => {
  function sampleScene() {
    const root = new THREE.Group(), modes = createModelSurfaceModes();
    const fog = createModelFog(new THREE.Scene());
    const bodyMat = new THREE.MeshStandardMaterial({name: 'Body', color: 0x336699, map: new THREE.Texture()});
    const trimMat = new THREE.MeshStandardMaterial({name: 'Trim', color: 0xffffff});
    const unlitMat = new THREE.MeshBasicMaterial({name: 'Unlit'});
    const bodyA = new THREE.Mesh(new THREE.BoxGeometry(), bodyMat);
    const bodyB = new THREE.Mesh(new THREE.BoxGeometry(), bodyMat);
    const multi = new THREE.Mesh(new THREE.BoxGeometry(), [trimMat, unlitMat]);
    root.add(bodyA, bodyB, multi);
    extendModelMaterials(root, modelStageChanges(fog.change, modes));
    return {modes, bodyMat, trimMat, unlitMat, bodyA, bodyB, multi, maps: createModelActorMaterialMaps(root)};
  }

  it('clones matched materials, preserves stage shaders, deduplicates textures, tints, replaces and disposes', () => {
    const {modes, bodyMat, trimMat, unlitMat, bodyA, bodyB, multi, maps} = sampleScene();
    const sharedImg = fakeImage('shared');
    const origFreed = trackDispose(bodyMat), origMapFreed = bodyMat.map ? trackDispose(bodyMat.map) : () => 0;
    maps.apply(validMaps({
      Body: {image: sharedImg, color: [1, 0, 0]},
      Trim: {image: sharedImg, colorSpace: 'srgb', flipY: false},
      Unlit: {image: sharedImg},
    }));
    const bodyClone = standardMaterial(bodyA);
    assert.equal(bodyB.material, bodyClone, 'meshes sharing one original share one clone');
    assert.notEqual(bodyClone, bodyMat);
    assert.ok(Array.isArray(multi.material) && multi.material[0] instanceof THREE.MeshStandardMaterial);
    assert.notEqual(multi.material[0], trimMat);
    assert.equal(multi.material[1], unlitMat, 'non-standard material is untouched');
    const trimClone = multi.material[0];
    assert.equal(bodyClone.map, trimClone.map, 'identical (image, colorSpace, flipY) deduplicates to one texture');
    assert.ok(bodyClone.map instanceof THREE.Texture);
    assert.deepEqual([bodyClone.map.colorSpace, bodyClone.map.flipY, bodyClone.map.version > 0],
      [THREE.SRGBColorSpace, false, true]);
    assert.ok(modelMaterialOwned(bodyClone));
    assert.deepEqual(modelMaterialChanges(bodyClone).map(({key}) => key),
      ['model-stage-fog', 'model-surface-mode:lit']);
    modes.set('clay');
    assert.equal(bodyClone.customProgramCacheKey(), 'model-stage-fog model-surface-mode:clay');
    assert.deepEqual(bodyClone.color.toArray(), new THREE.Color().setRGB(1, 0, 0, THREE.SRGBColorSpace).toArray());
    assert.equal(bodyMat.color.getHex(), 0x336699, 'original material color is never mutated');
    // Same image with distinct colorSpace/flipY gets distinct textures; prior clone & texture are disposed.
    const cloneFreed = trackDispose(bodyClone), texFreed = trackDispose(bodyClone.map);
    maps.apply(validMaps({
      Body: {image: sharedImg, colorSpace: 'linear', flipY: true},
      Trim: {image: sharedImg, colorSpace: 'srgb', flipY: true},
    }));
    assert.deepEqual([cloneFreed(), texFreed()], [1, 1]);
    const nextClone = standardMaterial(bodyA);
    assert.ok(Array.isArray(multi.material) && multi.material[0] instanceof THREE.MeshStandardMaterial);
    assert.ok(nextClone.map instanceof THREE.Texture && multi.material[0].map instanceof THREE.Texture);
    assert.notEqual(nextClone.map, multi.material[0].map, 'distinct colorSpace gets distinct texture');
    assert.deepEqual([nextClone.map.colorSpace, nextClone.map.flipY], [THREE.NoColorSpace, true]);
    assert.equal(nextClone.color.getHex(), 0x336699, 'omitted color clones from original, not prior override');
    // Clearing with null restores originals and disposes clones/textures; originals are never disposed here.
    const nextFreed = trackDispose(nextClone), nextTexFreed = trackDispose(nextClone.map);
    maps.apply(null);
    assert.deepEqual([bodyA.material, bodyB.material, Array.isArray(multi.material) && multi.material[0]],
      [bodyMat, bodyMat, trimMat]);
    assert.deepEqual([nextFreed(), nextTexFreed(), origFreed(), origMapFreed()], [1, 1, 0, 0]);
    maps.dispose();
  });
});

describe('stage integration, inspection and route refusals', () => {
  it('keeps inspection on shown clones, refuses bad routes, and disposes cleanly on actor dispose', async () => {
    const files: Record<string, Uint8Array> = {[PULSE.webProgram.path]: new TextEncoder().encode(PULSE_PROGRAM),
      [MASK.path]: new Uint8Array([1, 2, 3])};
    const scene = new THREE.Scene(), modes = createModelSurfaceModes();
    const descriptions = createModelStageDescriptions({
      policy: modelStagePolicy({reviewKey: 'review', clock: 'local', floor: false, grid: false,
        kinds: [...kinds().values()]}),
      theme: THEME,
      stage: {scene, fog: createModelFog(scene), shared: createModelStageSharedValues(), compile: () => undefined,
        lighting: {load: () => [], attach: () => () => undefined, prepare: () => () => undefined},
        frame: () => undefined, requestFit: () => undefined},
      modes,
      load: async () => {const loaded = kindFile(); loaded.body.material.name = 'Body'; return loaded.asset;},
      read: async path => files[path].slice().buffer,
      decode: async () => ({image: validMaps({m: {image: fakeImage('mask')}}).m.image, close: () => undefined}),
    });
    const set = {tinted: {[RENDERERS.body]: record(), [RENDERERS.eyes]: {kind: 'file'},
      [RENDERERS.line]: {kind: 'file'}}};
    await descriptions.set(describing({actors: {focus: 'a', actors: [declaration('a'), terrainActor()]}}));
    const [fileActor] = descriptions.actors.actors;
    const body = fileActor.drawn.scene.getObjectByProperty('type', 'Mesh');
    assert.ok(body instanceof THREE.Mesh);
    const original = body.material;
    refused(() => applyModelActorMaterialMaps(descriptions.actors.actors, 'missing', null), /no declared actor/);
    refused(() => applyModelActorMaterialMaps(descriptions.actors.actors, TERRAIN_ID, {Body: {image: fakeImage('x')}}),
      /terrain/);
    applyModelActorMaterialMaps(descriptions.actors.actors, 'a', {Body: {image: fakeImage('tex')}});
    const clone = standardMaterial(body), beforeVersion = clone.version;
    assert.notEqual(clone, original);
    assert.equal(fileActor.materials.available, true);
    fileActor.materials.refresh();
    assert.equal(clone.version, beforeVersion + 1, 'inspection.refresh updates the currently shown clone');
    // Invalid update refuses without losing active overrides.
    refused(() => applyModelActorMaterialMaps(descriptions.actors.actors, 'a', {Body: {image: null}}), /image/);
    assert.equal(body.material, clone);
    // Switching to a surface set while material maps are active is refused without clobbering the clone.
    const withSet = describing({surfaceSets: set,
      actors: {focus: 'a', actors: [declaration('a', 'otter', {surfaces: {from: 'set', set: 'tinted'}})]}});
    refused(() => descriptions.set(withSet), /active material maps/);
    assert.equal(body.material, clone);
    // Clearing maps with null allows switching to a surface set, which then refuses setActorMaterialMaps.
    applyModelActorMaterialMaps(descriptions.actors.actors, 'a', null);
    assert.equal(body.material, original);
    await descriptions.set(withSet);
    refused(() => applyModelActorMaterialMaps(descriptions.actors.actors, 'a', {Body: {image: fakeImage('tex')}}),
      /surface set/);
    // actor.dispose restores originals and frees clones, uploaded textures and originals once each.
    const root = new THREE.Group(), mat = new THREE.MeshStandardMaterial({name: 'Body'});
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), mat);
    root.add(mesh);
    const standalone = createModelActor({scene: root, clips: [], renderers: () => new Map()},
      declaration('s'), actorContext().context);
    standalone.setMaterialMaps({Body: {image: fakeImage('d')}});
    const mapped = standardMaterial(mesh);
    assert.ok(mapped.map instanceof THREE.Texture);
    const freed = [trackDispose(mapped), trackDispose(mapped.map), trackDispose(mat)];
    standalone.dispose();
    assert.deepEqual(freed.map(count => count()), [1, 1, 1]);
    descriptions.dispose();
  });
});
