import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {ModelStageCameraSnapshot} from './model.ts';
import {MODEL_STAGE as settings} from './model.ts';
import {MODEL_STAGE_FRAMING, type ModelStageFraming} from './framingModel.ts';
import {CAMERA_COORDS, cameraStatesFieldOfView, UNSTATED_FIELD_OF_VIEW, type ModelPreviewCamera}
  from './presentation.ts';

type CameraControls = Pick<OrbitControls, 'target' | 'enabled' | 'update'>
  & Partial<Pick<OrbitControls, 'maxDistance'>>;

// The camera follows the described framing: a fit, taken again whenever one is requested, or a held pose that no fit
// request moves. Whether the person may orbit is the description's, applied with the framing.
export function createModelFraming(camera: THREE.PerspectiveCamera, controls: CameraControls) {
  const maximum = controls.maxDistance;
  let fitRequested = true, held = false;
  // The orbit's reach never stops short of the framed distance, so the controls never pull the framing in.
  const reach = (distance: number) => {
    if (maximum === undefined) return;
    const nextReach = Math.max(maximum, distance);
    if (controls.maxDistance !== nextReach) controls.maxDistance = nextReach;
  };
  const setFieldOfView = (fieldOfView: number) => {
    if (camera.fov === fieldOfView) return;
    camera.fov = fieldOfView;
    camera.updateProjectionMatrix();
  };
  const poseScratch = new Float64Array(CAMERA_COORDS.length);
  const poseCoordinates = (coords: Float64Array) => {
    held = true;
    fitRequested = false;
    camera.position.set(coords[CAMERA_COORDS.px], coords[CAMERA_COORDS.py], coords[CAMERA_COORDS.pz]);
    controls.target.set(coords[CAMERA_COORDS.tx], coords[CAMERA_COORDS.ty], coords[CAMERA_COORDS.tz]);
    setFieldOfView(cameraStatesFieldOfView(coords) ? coords[CAMERA_COORDS.fov] : settings.fieldOfView);
    reach(camera.position.distanceTo(controls.target));
    camera.lookAt(controls.target);
    camera.updateMatrixWorld(true);
  };
  const applyPose = (next: ModelPreviewCamera) => {
    poseScratch[CAMERA_COORDS.px] = next.position[0];
    poseScratch[CAMERA_COORDS.py] = next.position[1];
    poseScratch[CAMERA_COORDS.pz] = next.position[2];
    poseScratch[CAMERA_COORDS.tx] = next.target[0];
    poseScratch[CAMERA_COORDS.ty] = next.target[1];
    poseScratch[CAMERA_COORDS.tz] = next.target[2];
    poseScratch[CAMERA_COORDS.fov] = next.fieldOfView ?? UNSTATED_FIELD_OF_VIEW;
    poseCoordinates(poseScratch);
  };
  // The far plane is the look's (lighting.ts), and never stops short of the far side of what the fit framed: a wide
  // fit on a narrow view stands the camera further off than the look's far plane reaches, which would draw nothing.
  const far = {look: camera.far, framed: 0};
  const depth = () => {
    camera.far = Math.max(far.look, far.framed);
    camera.updateProjectionMatrix();
  };
  return {
    requestFit() {if (!held) fitRequested = true;},
    /** The look's far plane, a time's own (lookModel.ts). */
    setFarPlane(farPlane: number) {
      far.look = farPlane;
      depth();
    },
    pose: applyPose,
    poseCoordinates,
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
      far.framed = fitted + bounds.getBoundingSphere(new THREE.Sphere()).radius;
      depth();
      if (controls.enabled) controls.update();
      else camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
      fitRequested = false;
    },
    cameraSnapshot(): ModelStageCameraSnapshot {
      return Object.freeze({position: Object.freeze(camera.position.toArray()),
        target: Object.freeze(controls.target.toArray()), fieldOfView: camera.fov, held});
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

export type ModelFraming = ReturnType<typeof createModelFraming>;
