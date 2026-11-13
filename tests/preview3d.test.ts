import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_REST_POSE, MODEL_STAGE, modelStagePolicy} from '../src/react/preview3d/model.ts';
import {applyModelTransform, disposeModelObject, prepareModelAsset} from '../src/react/preview3d/asset.ts';
import {createModelFraming} from '../src/react/preview3d/camera.ts';
import {MODEL_STAGE_ORIGIN, MODEL_STAGE_SIZE} from '../src/react/preview3d/sizeModel.ts';
import {MODEL_STAGE_FRAMING} from '../src/react/preview3d/framingModel.ts';

const REAL = {rule: MODEL_STAGE_SIZE.real} as const;
const normalized = (height: number) => ({rule: MODEL_STAGE_SIZE.normalized, height} as const);

const assetBox = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshBasicMaterial()));
  scene.scale.setScalar(2);
  scene.position.set(8, 3, -2);
  return {scene};
};
const boundsOf = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object);

describe('shared model presentation', () => {
  it('fixes the stated clock, floor and grid at creation, and refuses an option left unstated', () => {
    assert.equal(MODEL_REST_POSE, 'rest-pose');
    assert.equal(MODEL_STAGE.normalizedHeight, 2);
    const stated = {reviewKey: 'review', clock: 'local', floor: true, grid: false, kinds: []} as const;
    assert.deepEqual(modelStagePolicy(stated), {clock: 'local', floor: true, grid: false, kinds: new Map()});
    for (const aid of ['floor', 'grid'] as const) {
      const {[aid]: _, ...unstated} = stated;
      assert.throws(() => modelStagePolicy(unstated as typeof stated), new RegExp(`stage's ${aid} is stated`));
    }
  });

  it('preserves authored scale and position when both framing transformations are disabled', () => {
    const asset = assetBox();
    const {placement, size} = prepareModelAsset(asset);
    assert.equal(size(REAL, MODEL_STAGE_ORIGIN.file), 1);
    assert.equal(placement.children[0], asset.scene);
    assert.deepEqual(asset.scene.scale.toArray(), [2, 2, 2]);
    assert.deepEqual(asset.scene.position.toArray(), [8, 3, -2]);
    assert.equal(boundsOf(placement).getSize(new THREE.Vector3()).y, 8);
    disposeModelObject(placement);
  });

  it('normalizes height independently of placement and applies commands to a separate wrapper', () => {
    const asset = assetBox();
    const {placement, size} = prepareModelAsset(asset);
    assert.equal(size(normalized(4), MODEL_STAGE_ORIGIN.file), 0.5);
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
    const {placement, size} = prepareModelAsset(asset);
    size(REAL, MODEL_STAGE_ORIGIN.centred);
    const bounds = boundsOf(placement);
    assert.equal(bounds.min.y, 0);
    assert.deepEqual(bounds.getCenter(new THREE.Vector3()).toArray(), [0, 4, 0]);
    assert.deepEqual(asset.scene.scale.toArray(), [2, 2, 2]);
    disposeModelObject(placement);
  });

  it('applies the stage\'s size rule over the file\'s own scale, never compounding, and keeps it on the floor', () => {
    const asset = assetBox();
    const {placement, size} = prepareModelAsset(asset);
    const read = () => {
      const bounds = boundsOf(placement);
      return [bounds.getSize(new THREE.Vector3()).y, bounds.min.y, ...bounds.getCenter(new THREE.Vector3()).toArray()];
    };
    size(normalized(2), MODEL_STAGE_ORIGIN.centred);
    const once = read();
    assert.deepEqual(once, [2, 0, 0, 1, 0]);
    for (const rule of [normalized(5), REAL, normalized(2)]) size(rule, MODEL_STAGE_ORIGIN.centred);
    assert.deepEqual(read(), once);
    size(REAL, MODEL_STAGE_ORIGIN.centred);
    assert.deepEqual([read()[0], asset.scene.scale.toArray()], [8, [2, 2, 2]]);
    disposeModelObject(placement);
  });

  it('holds a posed framing across fit requests, fits a fit framing, and takes orbit from its own field', () => {
    const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, 1, 0.01, 100);
    const controls = {target: new THREE.Vector3(), enabled: true, update: () => true};
    const framing = createModelFraming(camera, controls);
    const asset = assetBox(), bounds = boundsOf(asset.scene);
    const pose = {kind: MODEL_STAGE_FRAMING.pose, position: [30, 40, 50], target: [1, 2, 3]} as const;
    framing.frame(pose, false);
    framing.requestFit();
    framing.fit(() => bounds);
    assert.deepEqual([camera.position.toArray(), controls.target.toArray(), controls.enabled],
      [[30, 40, 50], [1, 2, 3], false]);
    // Orbit is the description's own: a held pose may be orbited, and framing it again returns to the pose.
    framing.frame(pose, true);
    camera.position.set(7, 7, 7);
    framing.frame(pose, true);
    assert.deepEqual([camera.position.toArray(), controls.enabled], [[30, 40, 50], true]);
    framing.frame({kind: MODEL_STAGE_FRAMING.focus}, false);
    framing.fit(() => bounds);
    assert.notDeepEqual(camera.position.toArray(), [30, 40, 50]);
    assert.equal(controls.enabled, false);
    disposeModelObject(asset.scene);
  });

  it('measures nothing on a frame with no fit due, and holds a far pose against the orbit\'s reach', () => {
    const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, 1, 0.01, 100);
    const controls = {target: new THREE.Vector3(), enabled: true, maxDistance: MODEL_STAGE.cameraMaximum, update() {
      camera.position.sub(this.target).clampLength(MODEL_STAGE.cameraMinimum, this.maxDistance).add(this.target);
      return true;
    }};
    const framing = createModelFraming(camera, controls);
    let measured = 0;
    const measure = () => {
      measured++;
      return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
    };
    framing.frame({kind: MODEL_STAGE_FRAMING.focus}, true);
    framing.fit(measure);
    framing.fit(measure);
    assert.equal(measured, 1);
    framing.frame({kind: MODEL_STAGE_FRAMING.pose, position: [0, 0, 40], target: [0, 0, 0]}, true);
    controls.update();
    assert.deepEqual(camera.position.toArray(), [0, 0, 40]);
  });

  it('never leaves the orbit\'s reach short of the fitted distance', () => {
    const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, 1, 0.01, 100);
    const controls = {target: new THREE.Vector3(), enabled: true, maxDistance: MODEL_STAGE.cameraMaximum,
      update: () => true};
    const framing = createModelFraming(camera, controls);
    framing.frame({kind: MODEL_STAGE_FRAMING.all}, true);
    framing.fit(() => new THREE.Box3(new THREE.Vector3(-40, 0, -40), new THREE.Vector3(40, 10, 40)));
    assert.ok(camera.position.distanceTo(controls.target) <= controls.maxDistance + 1e-9);
    assert.ok(controls.maxDistance > MODEL_STAGE.cameraMaximum);
    framing.frame({kind: MODEL_STAGE_FRAMING.focus}, true);
    framing.fit(() => new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)));
    assert.equal(controls.maxDistance, MODEL_STAGE.cameraMaximum);
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
