import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MODEL_STAGE as settings} from './model.ts';
import {MODEL_STAGE_FRAMING, type ModelStageFraming} from './framingModel.ts';
import type {ModelPreviewCamera} from './presentation.ts';

type CameraControls = Pick<OrbitControls, 'target' | 'enabled' | 'update'>
  & Partial<Pick<OrbitControls, 'maxDistance'>>;

// The camera follows the described framing: a fit, taken again whenever one is requested, or a held pose that no fit
// request moves. Whether the person may orbit is the description's, applied with the framing.
export function createModelFraming(camera: THREE.PerspectiveCamera, controls: CameraControls) {
  const maximum = controls.maxDistance;
  let fitRequested = true, held = false;
  // The orbit's reach never stops short of the framed distance, so the controls never pull the framing in.
  const reach = (distance: number) => {if (maximum !== undefined) controls.maxDistance = Math.max(maximum, distance);};
  const setFieldOfView = (fieldOfView: number) => {
    if (camera.fov === fieldOfView) return;
    camera.fov = fieldOfView;
    camera.updateProjectionMatrix();
  };
  const applyPose = (next: ModelPreviewCamera) => {
    camera.position.fromArray(next.position);
    controls.target.fromArray(next.target);
    setFieldOfView(next.fieldOfView ?? settings.fieldOfView);
    reach(camera.position.distanceTo(controls.target));
    camera.lookAt(controls.target);
    camera.updateMatrixWorld(true);
  };
  // Nor does the far plane stop short of the far side of what the fit framed: a wide fit on a narrow view stands the
  // camera further off than the stage's own far plane reaches, which would draw nothing.
  const depth = (distance: number) => {
    camera.far = Math.max(settings.farPlane, distance);
    camera.updateProjectionMatrix();
  };
  return {
    requestFit() {if (!held) fitRequested = true;},
    pose(next: ModelPreviewCamera) {
      held = true;
      fitRequested = false;
      applyPose(next);
    },
    frame(framing: ModelStageFraming, orbit: boolean) {
      controls.enabled = orbit;
      held = framing.kind === MODEL_STAGE_FRAMING.pose;
      fitRequested = !held;
      if (framing.kind !== MODEL_STAGE_FRAMING.pose) {
        setFieldOfView(settings.fieldOfView);
        return;
      }
      applyPose(framing);
    },
    /** Fits what is drawn, measured only when a fit is due. */
    fit(measure: () => THREE.Box3) {
      if (!fitRequested) return;
      const bounds = measure(), fitted = fitModelCamera(bounds, camera, controls);
      reach(fitted);
      depth(fitted + bounds.getBoundingSphere(new THREE.Sphere()).radius);
      if (controls.enabled) controls.update();
      else camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
      fitRequested = false;
    },
  };
}

function fitModelCamera(bounds: THREE.Box3, camera: THREE.PerspectiveCamera, controls: CameraControls) {
  const direction = new THREE.Vector3().fromArray(settings.cameraDirection).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const verticalTangent = Math.tan(THREE.MathUtils.degToRad(settings.fieldOfView / 2));
  const horizontalTangent = verticalTangent * camera.aspect;
  bounds.getCenter(controls.target);
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new THREE.Vector3(x, y, z).sub(controls.target);
        distance = Math.max(distance, Math.abs(offset.dot(right)) / horizontalTangent + offset.dot(direction),
          Math.abs(offset.dot(up)) / verticalTangent + offset.dot(direction));
      }
    }
  }
  const fitted = distance * settings.fitPadding;
  camera.position.copy(direction.multiplyScalar(fitted).add(controls.target));
  return fitted;
}
