import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_ACTOR_REFUSAL, MODEL_PREVIEW_CAMERA_REFUSAL, MODEL_PREVIEW_CAPABILITIES, MODEL_STAGE,
  modelFrameScope, modelPreviewFrame, modelStageDescription, validateModelFrame}
  from '../src/react/preview3d/model.ts';
import {modelStageDescriptionChanges} from '../src/react/preview3d/descriptionModel.ts';
import {modelPreviewCamera} from '../src/react/preview3d/presentation.ts';
import {createModelDescriptionRequests} from '../src/react/preview3d/previewDescription.ts';
import {applyModelFrame} from '../src/react/preview3d/actor.ts';
import {createModelFrameInbox} from '../src/react/preview3d/frameInbox.ts';
import {declaration, describing, entity, fileScene, frame, layer, makeActor, makeFraming, refused, sample}
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

describe('atomic per-frame camera application and inbox delivery', () => {
  it('commits actors and camera atomically, orients lookAt, resets unstated fov, and refuses whole', () => {
    const {actor} = makeActor('a', [{name: 'idle', duration: 2}]);
    const scope = modelFrameScope(fileScene([actor.declaration]), new Map());
    const {camera, controls, coordinates, applyCamera} = makeFraming();
    const run = (raw: unknown, sink = applyCamera) =>
      applyModelFrame([actor], validateModelFrame(raw, scope, coordinates), sink);
    const applied = () => ({pos: actor.snapshot().pose.position, cam: camera.position.toArray(), fov: camera.fov});
    run({
      ...frame(0.5, entity('a', [layer(sample('idle', 0.5))], [3, 0, 0])),
      camera: {position: [1, 2, 9], target: [0, 1, 0], fieldOfView: 50},
    });
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    const expectedForward = new THREE.Vector3(0, 1, 0).sub(new THREE.Vector3(1, 2, 9)).normalize();
    assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(expectedForward) < 1e-6);
    // Refuses an unbranded object bypassed past TypeScript before touching actors or camera, naming validateModelFrame.
    refused(() => Reflect.apply(applyModelFrame, undefined, [
      [actor], {simulationTimeSeconds: 0.8, entities: [], cameraCoordinates: null}, applyCamera,
    ]), MODEL_ACTOR_REFUSAL.unvalidated);
    const otherScope = modelFrameScope(fileScene([actor.declaration, declaration('b', 'otter')]), new Map());
    const unshown = validateModelFrame({...frame(0.9, entity('a', [], [99, 0, 0]), entity('b', [], [1, 0, 0])),
      camera: {position: [9, 9, 9], target: [0, 0, 0], fieldOfView: 65}}, otherScope, coordinates);
    refused(() => applyModelFrame([actor], unshown, applyCamera), MODEL_ACTOR_REFUSAL.scope);
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Invalid camera refuses before actor changes.
    refused(() => run({
      ...frame(1, entity('a', [], [99, 0, 0])),
      camera: {position: [5, 5, 5], target: [0, 0, 0], fieldOfView: 180},
    }), MODEL_PREVIEW_CAMERA_REFUSAL.fieldOfView('Frame camera'));
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Entity failing during actor.prepare (clip time out of bounds) leaves camera unchanged.
    refused(() => run({
      ...frame(1.5, entity('a', [layer(sample('idle', 99))], [50, 0, 0])),
      camera: {position: [9, 9, 9], target: [0, 0, 0], fieldOfView: 65},
    }), /^Actor a: clip idle time 99 lies outside \[0, 2\] seconds\.$/);
    assert.deepEqual(applied(), {pos: [3, 0, 0], cam: [1, 2, 9], fov: 50});
    // Frame without camera updates actor without touching held camera or fov.
    let cameraCalls = 0;
    run(frame(2, entity('a', [], [7, 0, 0])), () => {cameraCalls++;});
    assert.deepEqual([cameraCalls, actor.snapshot().pose.position, camera.fov, controls.target.toArray()],
      [0, [7, 0, 0], 50, [0, 1, 0]]);
    // Frame with camera omitting fieldOfView restores MODEL_STAGE.fieldOfView (kills held-fov carry-over mutant).
    run({
      ...frame(2.5, entity('a', [], [8, 0, 0])),
      camera: {position: [2, 3, 9], target: [0, 2, 0]},
    });
    assert.deepEqual(applied(), {pos: [8, 0, 0], cam: [2, 3, 9], fov: MODEL_STAGE.fieldOfView});
    assert.deepEqual(controls.target.toArray(), [0, 2, 0]);
    actor.dispose();
  });

  it('validates once through the frame inbox without allocating a frozen camera, and refuses undeclared actors', () => {
    const {actor} = makeActor('a', []);
    const declared = fileScene([actor.declaration]);
    const {camera, applyCamera} = makeFraming();
    const inbox = createModelFrameInbox();
    inbox.describe(declared, []);
    const delivered: unknown[] = [];
    inbox.attach(value => {
      delivered.push(value);
      applyModelFrame([actor], value, applyCamera);
    });
    let entityReads = 0, cameraReads = 0;
    const rawEntities = [entity('a', [], [2, 0, 0])];
    const rawCamera = {position: [0, 1, 5], target: [0, 0, 0], fieldOfView: 46};
    const countedFrame = {
      simulationTimeSeconds: 0,
      get entities() {entityReads++; return rawEntities;},
      get camera() {cameraReads++; return rawCamera;},
    };
    assert.equal(inbox.receive(countedFrame), 'ready');
    assert.deepEqual([entityReads, cameraReads, camera.position.toArray(), camera.fov], [1, 1, [0, 1, 5], 46]);
    assert.equal(typeof delivered[0] === 'object' && delivered[0] !== null && 'camera' in delivered[0], false);
    assert.equal(inbox.receive({...frame(1), camera: {position: [0, 1, 5], target: [0, 0, 0], fieldOfView: -5}}),
      'error');
    inbox.detach();
    const pendingPos = [4, 2, 7];
    assert.equal(inbox.receive({...frame(2, entity('a', [], [5, 0, 0])),
      camera: {position: pendingPos, target: [0, 0, 0]}}), 'pending');
    pendingPos[0] = 99;
    assert.equal(inbox.attach(value => applyModelFrame([actor], value, applyCamera)), 'ready');
    assert.deepEqual([camera.position.toArray(), camera.fov], [[4, 2, 7], MODEL_STAGE.fieldOfView]);
    // Validator refuses an undeclared actor directly against the inbox's applied scope.
    assert.equal(inbox.receive(frame(3, entity('b', [], [1, 0, 0], 'actor-mesh'))), 'error');
    assert.equal(inbox.failure instanceof Error ? inbox.failure.message : '', MODEL_ACTOR_REFUSAL.undeclared('b'));
    // Re-describing while detached drops a pending frame from the previous description.
    inbox.detach();
    assert.equal(inbox.receive(frame(3.5, entity('a', [], [6, 0, 0]))), 'pending');
    inbox.describe(fileScene([declaration('b', 'otter')]), []);
    assert.equal(inbox.status, 'waiting');
    actor.dispose();
  });

  it('publishes inbox scope only when the stage applies a description, keeping the shown scope while loading',
    async () => {
      const {actor: actorA} = makeActor('a', []), {actor: actorB} = makeActor('b', []);
      const {applyCamera} = makeFraming(), inbox = createModelFrameInbox();
      const shownA = modelStageDescription(describing({actors: {focus: 'a', actors: [actorA.declaration]}}));
      const nextB = modelStageDescription(describing({actors: {focus: 'b', actors: [actorB.declaration]}}));
      let liveActors = [actorA], resolveLoad: () => void = () => undefined;
      const requests = createModelDescriptionRequests(() => undefined, () => undefined, () => undefined,
        applied => inbox.describe(applied, []));
      requests.hold(shownA);
      inbox.attach(value => applyModelFrame(liveActors, value, applyCamera));
      requests.declare({snapshot: () => ({actorsPending: true}),
        setDescription: () => new Promise<void>(resolve => {resolveLoad = resolve;})}, nextB);
      assert.equal(inbox.receive(frame(1, entity('b', [], [2, 0, 0]))), 'error');
      assert.equal(inbox.failure instanceof Error ? inbox.failure.message : '', MODEL_ACTOR_REFUSAL.undeclared('b'));
      assert.equal(inbox.receive(frame(1.5, entity('a', [], [3, 0, 0]))), 'ready');
      assert.deepEqual(actorA.snapshot().pose.position, [3, 0, 0]);
      liveActors = [actorB];
      resolveLoad();
      await Promise.resolve();
      assert.equal(inbox.receive(frame(2, entity('a', [], [4, 0, 0]))), 'error');
      assert.equal(inbox.failure instanceof Error ? inbox.failure.message : '', MODEL_ACTOR_REFUSAL.undeclared('a'));
      assert.equal(inbox.receive(frame(2.5, entity('b', [], [6, 0, 0]))), 'ready');
      assert.deepEqual(actorB.snapshot().pose.position, [6, 0, 0]);
      actorA.dispose();
      actorB.dispose();
    });
});
