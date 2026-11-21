import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_PREVIEW_CAMERA_REFUSAL, MODEL_PREVIEW_CAPABILITIES, MODEL_STAGE, MODEL_STAGE_FRAMING,
  modelFrameScope, modelPreviewFrame, modelStageDescription}
  from '../src/react/preview3d/model.ts';
import {modelStageDescriptionChanges} from '../src/react/preview3d/descriptionModel.ts';
import {modelPreviewCamera} from '../src/react/preview3d/presentation.ts';
import {applyModelFrame} from '../src/react/preview3d/actor.ts';
import {createModelFrameInbox} from '../src/react/preview3d/frameInbox.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {NO_FILES, declaration, describing, entity, fileScene, frame, layer, makeActor, makeFraming, refused, sample}
  from './preview3dActorFixture.ts';

describe('preview camera and framing fieldOfView validation', () => {
  it('validates optional fieldOfView strictly in (0, 180), omits it when unstated, and names where it failed', () => {
    assert.deepEqual(MODEL_PREVIEW_CAPABILITIES,
      {pose: true, animationLayers: true, partPoses: false, materials: false});
    const plain = modelPreviewCamera({position: [1, 2, 3], target: [0, 0, 0]}, 'Camera');
    assert.deepEqual(plain, {position: [1, 2, 3], target: [0, 0, 0]});
    assert.equal('fieldOfView' in plain, false);
    assert.ok(Object.isFrozen(plain));
    const wide = modelPreviewCamera({position: [1, 2, 3], target: [0, 0, 0], fieldOfView: 62.5}, 'Camera');
    assert.deepEqual(wide, {position: [1, 2, 3], target: [0, 0, 0], fieldOfView: 62.5});
    assert.ok(Object.isFrozen(wide));
    for (const bad of [0, -1, 180, 181, NaN, Infinity, -Infinity, '45', null, {}, undefined]) {
      refused(() => modelPreviewCamera({position: [1, 2, 3], target: [0, 0, 0], fieldOfView: bad}, 'The framing'),
        MODEL_PREVIEW_CAMERA_REFUSAL.fieldOfView('The framing'));
    }
  });

  it('validates framing pose through modelShape and detects framing changes by value', () => {
    const base = modelStageDescription(describing({framing: {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0]}}));
    assert.equal('fieldOfView' in base.framing, false);
    const zoomed = modelStageDescription(describing({
      framing: {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0], fieldOfView: 52},
    }));
    assert.deepEqual(zoomed.framing, {kind: 'pose', position: [0, 2, 5], target: [0, 0, 0], fieldOfView: 52});
    assert.deepEqual([...modelStageDescriptionChanges(base, zoomed)], ['framing']);
    refused(() => modelStageDescription(describing({framing: {kind: 'unknown'}})),
      /^The framing\.kind is one of focus, all, pose\.$/);
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

  it('validates optional frame.camera, freezes it, and refuses undefined, stray fields or bad values', () => {
    const scope = modelFrameScope(fileScene([declaration('a', 'actor-mesh')]), new Map());
    const withoutCamera = modelPreviewFrame(frame(0), scope);
    assert.equal('camera' in withoutCamera, false);
    const pos = [4, 5, 6], tgt = [0, 1, 0];
    const withCamera = modelPreviewFrame({...frame(0.5), camera: {position: pos, target: tgt, fieldOfView: 48}}, scope);
    pos[0] = 99;
    tgt[1] = 99;
    assert.deepEqual(withCamera.camera, {position: [4, 5, 6], target: [0, 1, 0], fieldOfView: 48});
    assert.ok(Object.isFrozen(withCamera.camera) && Object.isFrozen(withCamera.camera?.position));
    refused(() => modelPreviewFrame({...frame(0), camera: {position: [0, 0, 5], target: [0, 0, 0], fieldOfView: 0}},
      scope), MODEL_PREVIEW_CAMERA_REFUSAL.fieldOfView('Frame camera'));
    refused(() => modelPreviewFrame({...frame(0), camera: {position: [0, 0, 5], target: [0, 0, 0], extra: 1}},
      scope), /^Frame camera does not state extra/);
    refused(() => modelPreviewFrame({...frame(0), camera: undefined}, scope), /is a record of/);
    refused(() => modelPreviewFrame({...frame(0), camera: null}, scope), /is a record of/);
    refused(() => modelPreviewFrame({...frame(0), camera: {}}, scope), /^Frame camera omits position/);
    refused(() => modelPreviewFrame({...frame(0), camera: {position: [0, 0, 0], target: [0, 0, 0]}}, scope),
      MODEL_PREVIEW_CAMERA_REFUSAL.distinct('Frame camera'));
    refused(() => modelPreviewFrame(
      {...frame(0), camera: {position: [0, 0, 5], target: [0, 0, 0], fieldOfView: undefined}}, scope),
    /stated with no value/);
  });
});

describe('camera pose, fieldOfView updates, snapshot reporting and reset restore', () => {
  it('updates projection matrix only when fov changes, reports held snapshot, and restores on focus/all/reset', t => {
    const {camera, controls, framing} = makeFraming();
    assert.equal(framing.cameraSnapshot().held, false);
    const updateProj = t.mock.method(camera, 'updateProjectionMatrix');
    framing.pose({position: [0, 3, 25], target: [0, 1, 0]});
    assert.deepEqual(framing.cameraSnapshot(),
      {position: [0, 3, 25], target: [0, 1, 0], fieldOfView: MODEL_STAGE.fieldOfView, held: true});
    assert.equal(updateProj.mock.callCount(), 0, 'unchanged fov skips projection matrix rebuild');
    assert.ok(controls.maxDistance >= camera.position.distanceTo(controls.target) - 1e-9);
    framing.pose({position: [0, 3, 10], target: [0, 1, 0], fieldOfView: 55});
    assert.deepEqual([camera.fov, framing.cameraSnapshot().fieldOfView], [55, 55]);
    assert.equal(updateProj.mock.callCount(), 1);
    framing.pose({position: [2, 3, 10], target: [0, 1, 0], fieldOfView: 55});
    assert.equal(updateProj.mock.callCount(), 1, 'same fov on next tick skips projection rebuild');
    let measured = 0;
    framing.requestFit();
    framing.fit(() => {measured++; return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));});
    assert.equal(measured, 0, 'held per-frame pose ignores fit requests');
    framing.frame({kind: MODEL_STAGE_FRAMING.focus}, true);
    assert.deepEqual([camera.fov, framing.cameraSnapshot().held], [MODEL_STAGE.fieldOfView, false]);
    assert.equal(updateProj.mock.callCount(), 2);
    framing.frame({kind: MODEL_STAGE_FRAMING.all}, true);
    assert.equal(updateProj.mock.callCount(), 2, 'already at default fov: no extra rebuild');
    framing.fit(() => {measured++; return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));});
    assert.equal(measured, 1);
    const parts = createModelStageParts({...NO_FILES, scene: new THREE.Scene(),
      fog: {change: createModelFog(new THREE.Scene()).change}, kinds: new Map(), modes: createModelSurfaceModes(),
      lighting: {load: () => [], prepare: () => () => undefined}, frame: framing.frame});
    const describedFocus = modelStageDescription(describing());
    framing.pose({position: [1, 2, 3], target: [0, 0, 0], fieldOfView: 70});
    assert.equal(camera.fov, 70);
    parts.resetCamera(describedFocus);
    assert.deepEqual([camera.fov, framing.cameraSnapshot().held], [MODEL_STAGE.fieldOfView, false]);
    const describedPose = modelStageDescription(describing({
      framing: {kind: 'pose', position: [0, 4, 8], target: [0, 1, 0], fieldOfView: 44},
    }));
    parts.resetCamera(describedPose);
    assert.deepEqual(framing.cameraSnapshot(), {position: [0, 4, 8], target: [0, 1, 0], fieldOfView: 44, held: true});
  });
});

describe('atomic per-frame camera application and inbox delivery', () => {
  it('commits actors and camera atomically, resets unstated fov to MODEL_STAGE.fieldOfView, and refuses whole', () => {
    const {actor} = makeActor('a', [{name: 'idle', duration: 2}]);
    const scope = modelFrameScope(fileScene([actor.declaration]), new Map());
    const {camera, controls, channel} = makeFraming();
    const applied = () => ({pos: actor.snapshot().pose.position, cam: camera.position.toArray(), fov: camera.fov});
    applyModelFrame([actor], scope, {
      ...frame(0.5, entity('a', [layer(sample('idle', 0.5))], [3, 0, 0])),
      camera: {position: [1, 2, 9], target: [0, 1, 0], fieldOfView: 50},
    }, channel);
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Invalid camera refuses before actor changes.
    refused(() => applyModelFrame([actor], scope, {
      ...frame(1, entity('a', [], [99, 0, 0])),
      camera: {position: [5, 5, 5], target: [0, 0, 0], fieldOfView: 180},
    }, channel), MODEL_PREVIEW_CAMERA_REFUSAL.fieldOfView('Frame camera'));
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Entity failing during actor.prepare (clip time out of bounds) leaves camera unchanged.
    refused(() => applyModelFrame([actor], scope, {
      ...frame(1.5, entity('a', [layer(sample('idle', 99))], [50, 0, 0])),
      camera: {position: [9, 9, 9], target: [0, 0, 0], fieldOfView: 65},
    }, channel), /^Actor a: clip idle time 99 lies outside \[0, 2\] seconds\.$/);
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Frame without camera updates actor without touching held camera or fov.
    let cameraCalls = 0;
    applyModelFrame([actor], scope, frame(2, entity('a', [], [7, 0, 0])),
      {coordinates: channel.coordinates, apply: () => {cameraCalls++;}});
    assert.deepEqual([cameraCalls, actor.snapshot().pose.position, camera.fov, controls.target.toArray()],
      [0, [7, 0, 0], 50, [0, 1, 0]]);
    // Frame with camera omitting fieldOfView restores MODEL_STAGE.fieldOfView (kills held-fov carry-over mutant).
    applyModelFrame([actor], scope, {
      ...frame(2.5, entity('a', [], [8, 0, 0])),
      camera: {position: [2, 3, 9], target: [0, 2, 0]},
    }, channel);
    assert.deepEqual(applied(), {pos: [8, 0, 0], cam: [2, 3, 9], fov: MODEL_STAGE.fieldOfView});
    assert.deepEqual(controls.target.toArray(), [0, 2, 0]);
    actor.dispose();
  });

  it('validates and preserves frame.camera through the frame inbox', () => {
    const inbox = createModelFrameInbox();
    inbox.describe(fileScene([declaration('a', 'actor-mesh')]), []);
    const delivered: Array<number | undefined> = [];
    inbox.attach(value => delivered.push(value.camera?.fieldOfView));
    assert.equal(inbox.receive({...frame(0), camera: {position: [0, 1, 5], target: [0, 0, 0], fieldOfView: 46}}),
      'ready');
    assert.equal(inbox.receive({...frame(1), camera: {position: [0, 1, 5], target: [0, 0, 0], fieldOfView: -5}}),
      'error');
    assert.deepEqual(delivered, [46]);
  });
});
