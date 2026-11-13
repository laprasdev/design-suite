import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelRig} from '../src/react/preview3d/rig.ts';
import {createModelFraming} from '../src/react/preview3d/camera.ts';
import {disposeModelObject} from '../src/react/preview3d/asset.ts';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';

const theme = {colors: {stage: '#000', text: '#fff', surface: '#111', surfaceHi: '#222',
  accent: '#f8c', accentDeep: '#836', teal: '#6fd'}};
function fixture() {
  const asset = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
  const hidden = body.clone();
  hidden.visible = false;
  const base = new THREE.Bone(), tip = new THREE.Bone();
  tip.name = 'Tip';
  tip.position.set(0, 8, 0);
  base.add(tip);
  body.add(base);
  asset.add(body, hidden);
  asset.updateMatrixWorld(true);
  const rig = createModelRig(asset, theme, []);
  return {asset, body, hidden, base, tip, rig};
}
function cleanup(value: ReturnType<typeof fixture>) {
  disposeModelObject(value.rig.root);
  disposeModelObject(value.asset);
}

describe('shared rig display', () => {
  it('shows its aids in Rig and Both, keeps the authored visibility, and never writes a renderable\'s own', () => {
    const model = fixture();
    assert.deepEqual(model.rig.snapshot(), {display: 'model', modelVisible: true, visibleModelMeshes: 1,
      rigVisible: false, boneCount: 2, visibleRigJoints: 0, skeletonVisible: false});
    assert.deepEqual(model.rig.renderables.map(({node, visible}) => [node, visible]),
      [[model.body, true], [model.hidden, false]]);
    model.rig.setDisplay('rig');
    assert.deepEqual([model.body.visible, model.hidden.visible], [true, false]);
    assert.deepEqual(model.rig.snapshot(), {display: 'rig', modelVisible: true, visibleModelMeshes: 1,
      rigVisible: true, boneCount: 2, visibleRigJoints: 2, skeletonVisible: true});
    for (const mode of ['both', 'model'] as const) {
      model.rig.setDisplay(mode);
      assert.equal(model.rig.snapshot().rigVisible, mode === 'both');
    }
    cleanup(model);
  });

  it('keeps bones and joint instances moving while their owning mesh is hidden', () => {
    const model = fixture();
    const mixer = new THREE.AnimationMixer(model.asset);
    const clip = new THREE.AnimationClip('reach', 1,
      [new THREE.VectorKeyframeTrack('Tip.position', [0, 1], [0, 8, 0, 0, 12, 0])]);
    mixer.clipAction(clip).play();
    model.rig.setDisplay('rig');
    model.body.visible = false;
    mixer.update(0.5);
    model.asset.updateMatrixWorld(true);
    model.rig.update();
    const joints = model.rig.root.children.find(node => node instanceof THREE.InstancedMesh);
    assert.ok(joints instanceof THREE.InstancedMesh);
    const matrix = new THREE.Matrix4();
    joints.getMatrixAt(1, matrix);
    assert.equal(model.tip.getWorldPosition(new THREE.Vector3()).y, 10);
    assert.equal(new THREE.Vector3().setFromMatrixPosition(matrix).y, 10);
    mixer.stopAllAction();
    mixer.uncacheRoot(model.asset);
    cleanup(model);
  });

  it('frames every joint beyond mesh bounds in Rig and restores the catalog orbit limit afterward', () => {
    const model = fixture();
    model.tip.position.set(0, 25, 0);
    model.asset.updateMatrixWorld(true);
    const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, 1, 0.01, 100);
    const controls = {target: new THREE.Vector3(), enabled: true, maxDistance: 16, update() {
      camera.position.sub(this.target).clampLength(1, this.maxDistance).add(this.target);
      camera.lookAt(this.target);
      return true;
    }};
    const framing = createModelFraming(camera, controls, true);
    model.rig.setDisplay('rig');
    framing.fit(model.asset, model.rig.bounds());
    assert.equal(controls.maxDistance, Infinity);
    for (const bone of [model.base, model.tip]) {
      const projected = bone.getWorldPosition(new THREE.Vector3()).project(camera);
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1);
    }
    model.rig.setDisplay('model');
    framing.requestFit();
    framing.fit(model.asset);
    assert.equal(controls.maxDistance, 16);
    cleanup(model);
  });

  it('frames mesh and outlying helper joints together in Both', () => {
    const model = fixture();
    model.body.geometry.scale(20, 1, 1);
    model.tip.position.set(0, 25, 0);
    model.asset.updateMatrixWorld(true);
    model.rig.setDisplay('both');
    const bounds = model.rig.bounds();
    assert.ok(bounds.min.x <= -10 && bounds.max.x >= 10 && bounds.max.y >= 25);
    const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, 1, 0.01, 100);
    const controls = {target: new THREE.Vector3(), enabled: true, maxDistance: 16, update() {
      camera.lookAt(this.target);
      return true;
    }};
    const framing = createModelFraming(camera, controls, true);
    framing.fit(model.asset, bounds);
    for (const point of [new THREE.Vector3(-10, -1, 0), new THREE.Vector3(10, 1, 0),
      model.tip.getWorldPosition(new THREE.Vector3())]) {
      const projected = point.project(camera);
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1);
    }
    assert.equal(model.rig.snapshot().modelVisible, true);
    assert.equal(model.rig.snapshot().rigVisible, true);
    cleanup(model);
  });

  it('uses the supplied bright colors and releases joint instance, geometry and material resources', () => {
    const model = fixture();
    const helper = model.rig.root.children.find(node => node instanceof THREE.SkeletonHelper);
    const joints = model.rig.root.children.find(node => node instanceof THREE.InstancedMesh);
    assert.ok(helper instanceof THREE.SkeletonHelper);
    assert.ok(joints instanceof THREE.InstancedMesh);
    assert.ok(helper.material instanceof THREE.LineBasicMaterial);
    assert.ok(joints.material instanceof THREE.MeshBasicMaterial);
    assert.ok(helper.material.color.equals(new THREE.Color(theme.colors.teal)));
    assert.ok(joints.material.color.equals(new THREE.Color(theme.colors.text)));
    assert.equal(helper.material.vertexColors, false);
    assert.equal(helper.material.depthTest, false);
    const disposed: string[] = [];
    joints.addEventListener('dispose', () => disposed.push('instances'));
    joints.geometry.addEventListener('dispose', () => disposed.push('geometry'));
    joints.material.addEventListener('dispose', () => disposed.push('material'));
    disposeModelObject(model.rig.root);
    assert.deepEqual(disposed.sort(), ['geometry', 'instances', 'material']);
    disposeModelObject(model.asset);
  });
});
