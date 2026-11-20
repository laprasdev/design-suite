// The camera's fit: what it measures and when, and how far the orbit and the far plane reach for what it framed.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';
import {createModelFraming} from '../src/react/preview3d/camera.ts';
import {MODEL_STAGE_FRAMING} from '../src/react/preview3d/framingModel.ts';

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

  it('never leaves the far plane short of the far side of what a fit framed', () => {
    const camera = new THREE.PerspectiveCamera(MODEL_STAGE.fieldOfView, PORTRAIT_ASPECT, MODEL_STAGE.nearPlane,
      MODEL_STAGE.farPlane);
    const controls = {target: new THREE.Vector3(), enabled: false, update: () => true};
    const framing = createModelFraming(camera, controls);
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
});
