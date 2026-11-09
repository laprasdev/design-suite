import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_REST_POSE, MODEL_STAGE, modelStagePolicy} from '../src/react/preview3d/model.ts';
import {applyModelTransform, disposeModelObject, prepareModelAsset} from '../src/react/preview3d/asset.ts';
import {createModelFraming} from '../src/react/preview3d/camera.ts';

const assetBox = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshBasicMaterial()));
  scene.scale.setScalar(2);
  scene.position.set(8, 3, -2);
  return {scene};
};
const boundsOf = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);

describe('shared model presentation', () => {
  it('retains the catalog policy while allowing each stage aid to be disabled independently', () => {
    assert.equal(MODEL_REST_POSE, 'rest-pose');
    assert.equal(MODEL_STAGE.normalizedHeight, 2);
    const defaults = modelStagePolicy();
    assert.deepEqual(defaults, {clock: 'local', normalizeHeight: 2,
      centerOnFloor: true, floor: true, grid: true, orbit: true});
    for (const flag of ['centerOnFloor', 'floor', 'grid', 'orbit']) {
      assert.deepEqual(modelStagePolicy({[flag]: false}), {...defaults, [flag]: false});
    }
    for (const height of [0, -1, NaN, Infinity]) {
      assert.throws(() => modelStagePolicy({normalizeHeight: height}), /positive or null/);
    }
  });

  it('preserves authored scale and position when both framing transformations are disabled', () => {
    const asset = assetBox();
    const placement = prepareModelAsset(asset, modelStagePolicy({normalizeHeight: null, centerOnFloor: false}));
    assert.equal(placement.children[0], asset.scene);
    assert.deepEqual(asset.scene.scale.toArray(), [2, 2, 2]);
    assert.deepEqual(asset.scene.position.toArray(), [8, 3, -2]);
    assert.equal(boundsOf(placement).getSize(new THREE.Vector3()).y, 8);
    disposeModelObject(placement);
  });

  it('normalizes height independently of placement and applies commands to a separate wrapper', () => {
    const asset = assetBox();
    const placement = prepareModelAsset(asset, modelStagePolicy({normalizeHeight: 4, centerOnFloor: false}));
    assert.equal(boundsOf(placement).getSize(new THREE.Vector3()).y, 4);
    assert.deepEqual(asset.scene.position.toArray(), [8, 3, -2]);
    const authoredScale = asset.scene.scale.clone();
    applyModelTransform(placement, {position: [1, 2, 3], rotationQuaternion: [0, 1, 0, 0], scale: [3, 3, 3]});
    assert.deepEqual(placement.position.toArray(), [1, 2, 3]);
    assert.deepEqual(placement.quaternion.toArray(), [0, 1, 0, 0]);
    assert.equal(boundsOf(placement).getSize(new THREE.Vector3()).y, 12);
    assert.ok(asset.scene.scale.equals(authoredScale));
    assert.deepEqual(asset.scene.position.toArray(), [8, 3, -2]);
    disposeModelObject(placement);
  });

  it('can center an asset on the floor without changing its authored scale', () => {
    const asset = assetBox();
    const placement = prepareModelAsset(asset, modelStagePolicy({normalizeHeight: null}));
    const bounds = boundsOf(placement);
    assert.equal(bounds.min.y, 0);
    assert.deepEqual(bounds.getCenter(new THREE.Vector3()).toArray(), [0, 4, 0]);
    assert.deepEqual(asset.scene.scale.toArray(), [2, 2, 2]);
    disposeModelObject(placement);
  });

  it('holds the external camera across clip/resize fit requests until explicitly reset', () => {
    const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, 1, 0.01, 100);
    const controls = {target: new THREE.Vector3(), enabled: true, update: () => true};
    const framing = createModelFraming(camera, controls, true);
    const asset = assetBox();
    framing.setCamera({position: [30, 40, 50], target: [1, 2, 3]});
    framing.requestFit();
    framing.fit(asset.scene);
    assert.deepEqual(camera.position.toArray(), [30, 40, 50]);
    assert.deepEqual(controls.target.toArray(), [1, 2, 3]);
    assert.equal(controls.enabled, false);
    framing.resetCamera();
    framing.fit(asset.scene);
    assert.notDeepEqual(camera.position.toArray(), [30, 40, 50]);
    assert.equal(controls.enabled, true);
    disposeModelObject(asset.scene);
  });

  it('keeps orbit disabled after reset when the stage policy disables it', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = {target: new THREE.Vector3(), enabled: false, update: () => true};
    const framing = createModelFraming(camera, controls, false);
    framing.setCamera({position: [3, 4, 5], target: [0, 0, 0]});
    framing.resetCamera();
    assert.equal(controls.enabled, false);
  });

  it('frees each allocated bone texture once when multiple meshes share a skeleton', t => {
    const scene = new THREE.Group();
    const shared = new THREE.Skeleton([new THREE.Bone()]);
    const separate = new THREE.Skeleton([new THREE.Bone()]);
    const skeletons = [shared, separate];
    const disposed: THREE.Texture[] = [];
    const calls = skeletons.map(skeleton => t.mock.method(skeleton, 'dispose'));
    const textures = skeletons.map(skeleton => {
      skeleton.computeBoneTexture();
      assert.ok(skeleton.boneTexture);
      const texture = skeleton.boneTexture;
      texture.addEventListener('dispose', () => disposed.push(texture));
      return texture;
    });
    for (const skeleton of [shared, shared, separate]) {
      const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
      mesh.bind(skeleton);
      scene.add(mesh);
    }
    disposeModelObject(scene);
    assert.equal(disposed.length, textures.length);
    textures.forEach((texture, index) => assert.equal(disposed[index], texture));
    for (const skeleton of skeletons) assert.equal(skeleton.boneTexture, null);
    for (const dispose of calls) assert.equal(dispose.mock.calls.length, 1);
  });

  it('disposes mesh, line and texture resources, including diagnostic helpers', () => {
    const scene = new THREE.Group();
    const texture = new THREE.Texture();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({map: texture}));
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
    scene.add(mesh, line);
    const disposed: string[] = [];
    mesh.geometry.addEventListener('dispose', () => disposed.push('mesh'));
    mesh.material.addEventListener('dispose', () => disposed.push('material'));
    texture.addEventListener('dispose', () => disposed.push('texture'));
    line.geometry.addEventListener('dispose', () => disposed.push('line'));
    line.material.addEventListener('dispose', () => disposed.push('lineMaterial'));
    disposeModelObject(scene);
    assert.deepEqual(disposed.sort(), ['line', 'lineMaterial', 'material', 'mesh', 'texture']);
  });
});
