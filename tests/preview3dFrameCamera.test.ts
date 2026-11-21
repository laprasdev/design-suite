import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_PREVIEW_CAPABILITIES, MODEL_STAGE, MODEL_STAGE_FRAMING,
  modelFrameScope, modelPreviewFrame, modelStageDescription}
  from '../src/react/preview3d/model.ts';
import {modelStageDescriptionChanges} from '../src/react/preview3d/descriptionModel.ts';
import {modelPreviewCamera} from '../src/react/preview3d/presentation.ts';
import {createModelFraming} from '../src/react/preview3d/camera.ts';
import {applyModelFrame} from '../src/react/preview3d/actor.ts';
import {createModelFrameInbox} from '../src/react/preview3d/frameInbox.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {NO_FILES, declaration, describing, entity, fileScene, frame, layer, makeActor, refused, sample}
  from './preview3dActorFixture.ts';

const framingHarness = () => {
  const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, 1, 0.01, 100);
  const controls = {target: new THREE.Vector3(), enabled: true, maxDistance: MODEL_STAGE.cameraMaximum,
    update: () => true};
  return {camera, controls, framing: createModelFraming(camera, controls)};
};

describe('preview camera and framing fieldOfView validation', () => {
  it('validates optional fieldOfView strictly in (0, 180), omits it when unstated, and keeps capabilities', () => {
    assert.deepEqual(MODEL_PREVIEW_CAPABILITIES,
      {pose: true, animationLayers: true, partPoses: false, materials: false});
    const plain = modelPreviewCamera({position: [1, 2, 3], target: [0, 0, 0]});
    assert.deepEqual(plain, {position: [1, 2, 3], target: [0, 0, 0]});
    assert.equal('fieldOfView' in plain, false);
    assert.ok(Object.isFrozen(plain));
    const wide = modelPreviewCamera({position: [1, 2, 3], target: [0, 0, 0], fieldOfView: 62.5});
    assert.deepEqual(wide, {position: [1, 2, 3], target: [0, 0, 0], fieldOfView: 62.5});
    assert.ok(Object.isFrozen(wide));
    for (const bad of [0, -1, 180, 181, NaN, Infinity, -Infinity, '45', null, {}, undefined]) {
      refused(() => modelPreviewCamera({position: [1, 2, 3], target: [0, 0, 0], fieldOfView: bad}), /fieldOfView/);
    }
  });

  it('validates framing pose fieldOfView and detects framing changes by value', () => {
    const base = modelStageDescription(describing({framing: {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0]}}));
    assert.equal('fieldOfView' in base.framing, false);
    const zoomed = modelStageDescription(describing({
      framing: {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0], fieldOfView: 52},
    }));
    assert.deepEqual(zoomed.framing, {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0], fieldOfView: 52});
    assert.deepEqual([...modelStageDescriptionChanges(base, zoomed)], ['framing']);
    refused(() => modelStageDescription(describing({
      framing: {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0], fieldOfView: undefined},
    })), /stated with no value/);
    refused(() => modelStageDescription(describing({
      framing: {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0], extra: 1},
    })), /does not state extra/);
    refused(() => modelStageDescription(describing({framing: {kind: 'focus', fieldOfView: 50}})),
      /does not state fieldOfView/);
    refused(() => modelStageDescription(describing({framing: {kind: 'all', fieldOfView: 50}})),
      /does not state fieldOfView/);
  });

  it('validates optional frame.camera, freezes it, and refuses stated undefined or invalid values', () => {
    const scope = modelFrameScope(fileScene([declaration('a')]), new Map());
    const withoutCamera = modelPreviewFrame(frame(0), scope);
    assert.equal('camera' in withoutCamera, false);
    const pos = [4, 5, 6], tgt = [0, 1, 0];
    const withCamera = modelPreviewFrame({...frame(0.5), camera: {position: pos, target: tgt, fieldOfView: 48}}, scope);
    pos[0] = 99;
    tgt[1] = 99;
    assert.deepEqual(withCamera.camera, {position: [4, 5, 6], target: [0, 1, 0], fieldOfView: 48});
    assert.ok(Object.isFrozen(withCamera.camera) && Object.isFrozen(withCamera.camera?.position));
    for (const camera of [undefined, null, {}, {position: [0, 0, 0], target: [0, 0, 0]},
      {position: [0, 0, 5], target: [0, 0, 0], fieldOfView: 0},
      {position: [0, 0, 5], target: [0, 0, 0], fieldOfView: undefined}]) {
      refused(() => modelPreviewFrame({...frame(0), camera}, scope));
    }
  });
});

describe('camera pose, fieldOfView updates and reset restore', () => {
  it('updates projection matrix only when fov changes, holds against fit, and restores on focus/all/reset', t => {
    const {camera, controls, framing} = framingHarness();
    const updateProj = t.mock.method(camera, 'updateProjectionMatrix');
    framing.pose({position: [0, 3, 25], target: [0, 1, 0]});
    assert.deepEqual([camera.position.toArray(), controls.target.toArray(), camera.fov],
      [[0, 3, 25], [0, 1, 0], MODEL_STAGE.fieldOfView]);
    assert.equal(updateProj.mock.callCount(), 0, 'unchanged fov skips projection matrix rebuild');
    assert.ok(controls.maxDistance >= camera.position.distanceTo(controls.target) - 1e-9);
    framing.pose({position: [0, 3, 10], target: [0, 1, 0], fieldOfView: 55});
    assert.equal(camera.fov, 55);
    assert.equal(updateProj.mock.callCount(), 1);
    framing.pose({position: [2, 3, 10], target: [0, 1, 0], fieldOfView: 55});
    assert.equal(updateProj.mock.callCount(), 1, 'same fov on next tick skips projection rebuild');
    let measured = 0;
    framing.requestFit();
    framing.fit(() => {measured++; return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));});
    assert.equal(measured, 0, 'held per-frame pose ignores fit requests');
    // Switching back to focus restores default fov and re-enables fit.
    framing.frame({kind: MODEL_STAGE_FRAMING.focus}, true);
    assert.equal(camera.fov, MODEL_STAGE.fieldOfView);
    assert.equal(updateProj.mock.callCount(), 2);
    framing.frame({kind: MODEL_STAGE_FRAMING.all}, true);
    assert.equal(updateProj.mock.callCount(), 2, 'already at default fov: no extra rebuild');
    framing.fit(() => {measured++; return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));});
    assert.equal(measured, 1);
    // Described pose with fov and resetCamera via stageParts restore it cleanly.
    const parts = createModelStageParts({...NO_FILES, scene: new THREE.Scene(),
      fog: {change: createModelFog(new THREE.Scene()).change}, kinds: new Map(), modes: createModelSurfaceModes(),
      lighting: {load: () => [], prepare: () => () => undefined}, frame: framing.frame});
    const describedFocus = modelStageDescription(describing());
    framing.pose({position: [1, 2, 3], target: [0, 0, 0], fieldOfView: 70});
    assert.equal(camera.fov, 70);
    parts.resetCamera(describedFocus);
    assert.equal(camera.fov, MODEL_STAGE.fieldOfView);
    const describedPose = modelStageDescription(describing({
      framing: {kind: 'pose', position: [0, 4, 8], target: [0, 1, 0], fieldOfView: 44},
    }));
    parts.resetCamera(describedPose);
    assert.deepEqual([camera.position.toArray(), controls.target.toArray(), camera.fov], [[0, 4, 8], [0, 1, 0], 44]);
  });
});

describe('atomic per-frame camera application and inbox delivery', () => {
  it('commits actors and camera atomically, leaving both unchanged on any refusal', () => {
    const {actor} = makeActor('a', [{name: 'idle', duration: 2}]);
    const scope = modelFrameScope(fileScene([actor.declaration]), new Map());
    const {camera, controls, framing} = framingHarness();
    const applied = () => ({pos: actor.snapshot().pose.position, cam: camera.position.toArray(), fov: camera.fov});
    applyModelFrame([actor], scope, {
      ...frame(0.5, entity('a', [layer(sample('idle', 0.5))], [3, 0, 0])),
      camera: {position: [1, 2, 9], target: [0, 1, 0], fieldOfView: 50},
    }, framing.pose);
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Invalid camera refuses before actor changes.
    refused(() => applyModelFrame([actor], scope, {
      ...frame(1, entity('a', [], [99, 0, 0])),
      camera: {position: [5, 5, 5], target: [0, 0, 0], fieldOfView: 180},
    }, framing.pose));
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Entity failing during actor.prepare (clip time out of bounds) leaves camera unchanged.
    refused(() => applyModelFrame([actor], scope, {
      ...frame(1.5, entity('a', [layer(sample('idle', 99))], [50, 0, 0])),
      camera: {position: [9, 9, 9], target: [0, 0, 0], fieldOfView: 65},
    }, framing.pose));
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Frame without camera updates actor without touching camera.
    let cameraCalls = 0;
    applyModelFrame([actor], scope, frame(2, entity('a', [], [7, 0, 0])), () => {cameraCalls++;});
    assert.deepEqual([cameraCalls, actor.snapshot().pose.position, camera.fov, controls.target.toArray()],
      [0, [7, 0, 0], 50, [0, 1, 0]]);
    actor.dispose();
  });

  it('validates and preserves frame.camera through the frame inbox', () => {
    const inbox = createModelFrameInbox();
    inbox.describe(fileScene([declaration('a')]), []);
    const delivered: Array<number | undefined> = [];
    inbox.attach(value => delivered.push(value.camera?.fieldOfView));
    assert.equal(inbox.receive({...frame(0), camera: {position: [0, 1, 5], target: [0, 0, 0], fieldOfView: 46}}),
      'ready');
    assert.equal(inbox.receive({...frame(1), camera: {position: [0, 1, 5], target: [0, 0, 0], fieldOfView: -5}}),
      'error');
    assert.deepEqual(delivered, [46]);
  });
});
