// The camera's fit: what it measures and when, and how far the orbit and the far plane reach for what it framed.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_STAGE, modelStageDescription} from '../src/react/preview3d/model.ts';
import {createModelFraming} from '../src/react/preview3d/camera.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {MODEL_STAGE_FRAMING} from '../src/react/preview3d/framingModel.ts';
import {createModelSurfaceModes} from '../src/react/preview3d/materials.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {NO_FILES, describing, makeFraming} from './preview3dActorFixture.ts';

// A phone held upright, 390 by 844 px: the narrowest view a fit stands back for.
const PORTRAIT_ASPECT = 390 / 844;

describe('the stage\'s framing', () => {
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
    const {camera, controls, framing} = makeFraming();
    framing.frame({kind: MODEL_STAGE_FRAMING.all}, true);
    framing.fit(() => new THREE.Box3(new THREE.Vector3(-40, 0, -40), new THREE.Vector3(40, 10, 40)));
    assert.ok(camera.position.distanceTo(controls.target) <= controls.maxDistance + 1e-9);
    assert.ok(controls.maxDistance > MODEL_STAGE.cameraMaximum);
    framing.frame({kind: MODEL_STAGE_FRAMING.focus}, true);
    framing.fit(() => new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)));
    assert.equal(controls.maxDistance, MODEL_STAGE.cameraMaximum);
  });

  it('never leaves the far plane short of the far side of what a fit framed', () => {
    const {camera, framing} = makeFraming(PORTRAIT_ASPECT, MODEL_STAGE.nearPlane, MODEL_STAGE.farPlane, false);
    const wide = new THREE.Box3(new THREE.Vector3(-12, -2.5, -12), new THREE.Vector3(12, 1, 12));
    framing.frame({kind: MODEL_STAGE_FRAMING.all}, false);
    framing.fit(() => wide);
    const view = camera.matrixWorldInverse;
    for (const x of [wide.min.x, wide.max.x]) for (const y of [wide.min.y, wide.max.y]) for (const z of [wide.min.z,
      wide.max.z]) {
      const depth = -new THREE.Vector3(x, y, z).applyMatrix4(view).z;
      assert.ok(depth <= camera.far, `corner ${[x, y, z]} at ${depth} m lies past the far plane ${camera.far} m`);
    }
    assert.ok(camera.far > MODEL_STAGE.farPlane);
    framing.requestFit();
    framing.fit(() => new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)));
    assert.equal(camera.far, MODEL_STAGE.farPlane);
  });

  it('orients the camera forward vector toward target after pose and frame(pose)', () => {
    const {camera, framing} = makeFraming();
    const forward = () => camera.getWorldDirection(new THREE.Vector3());
    const expected = (from: readonly [number, number, number], to: readonly [number, number, number]) =>
      new THREE.Vector3(...to).sub(new THREE.Vector3(...from)).normalize();
    framing.pose({position: [3, 4, 5], target: [0, 1, -1], fieldOfView: 50});
    assert.ok(forward().distanceTo(expected([3, 4, 5], [0, 1, -1])) < 1e-6);
    framing.frame({kind: MODEL_STAGE_FRAMING.pose, position: [-4, 2, 3], target: [1, 0, -2]}, false);
    assert.ok(forward().distanceTo(expected([-4, 2, 3], [1, 0, -2])) < 1e-6);
  });

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
