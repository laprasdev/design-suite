import * as THREE from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {MODEL_STAGE as settings} from './model.ts';
import type {ModelStageCamera} from './model.ts';
import {modelPreviewCamera} from './presentation.ts';

type CameraControls = Pick<OrbitControls, 'target' | 'enabled' | 'update'>
  & Partial<Pick<OrbitControls, 'maxDistance'>>;

export function createModelFraming(camera: THREE.PerspectiveCamera, controls: CameraControls, orbit: boolean) {
  const maximum = controls.maxDistance;
  let fitRequested = true;
  let autoFit = true;
  const requestFit = () => {if (autoFit) fitRequested = true;};
  return {
    requestFit,
    resetCamera() {autoFit = true; controls.enabled = orbit; requestFit();},
    setCamera(value: ModelStageCamera) {
      const accepted = modelPreviewCamera(value);
      autoFit = false;
      fitRequested = false;
      controls.enabled = false;
      camera.position.fromArray(accepted.position);
      controls.target.fromArray(accepted.target);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld(true);
    },
    fit(object: THREE.Object3D, bounds?: THREE.Box3) {
      if (!fitRequested) return;
      if (maximum !== undefined) controls.maxDistance = bounds ? Infinity : maximum;
      fitModelCamera(object, camera, controls, bounds);
      fitRequested = false;
    },
  };
}

function fitModelCamera(object: THREE.Object3D, camera: THREE.PerspectiveCamera,
  controls: CameraControls, rigBounds?: THREE.Box3) {
  object.traverse(node => {
    if (node instanceof THREE.SkinnedMesh) {node.skeleton.update(); node.computeBoundingBox();}
  });
  const bounds = rigBounds ?? new THREE.Box3().setFromObject(object);
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
  camera.position.copy(direction.multiplyScalar(distance * settings.fitPadding).add(controls.target));
  if (controls.enabled) controls.update();
  else camera.lookAt(controls.target);
  camera.updateMatrixWorld(true);
}
