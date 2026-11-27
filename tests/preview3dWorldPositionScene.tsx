// Mounted in Chromium by preview3dWorldPosition.browser.test.ts: draws the square through the stage's kind program, one
// placement at a time, with an orthographic camera down -Z, and reads the frame's bytes back (pixelReadScene.tsx).
import * as THREE from 'three';
import {modelSurfaceKind} from '../src/react/preview3d/surfaceKindModel.ts';
import {createModelSurfaceProgram} from '../src/react/preview3d/surfaceProgram.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {
  placementTransform, squareCorners, WORLD_KIND, WORLD_PLACEMENT, WORLD_PROGRAM, WORLD_VIEW, WORLD_VIEWPORT,
  type WorldPlacement,
} from './preview3dWorldPositionCases.ts';
import {mountPixelReadScene} from './pixelReadScene.tsx';

const {extent, eye} = WORLD_VIEW, view = mountPixelReadScene(WORLD_VIEWPORT);
const camera = new THREE.OrthographicCamera(0, extent, extent, 0, 0.1, eye * 2);
camera.position.set(0, 0, eye);
camera.updateMatrixWorld();
const shared = createModelStageSharedValues();
const program = createModelSurfaceProgram(modelSurfaceKind(WORLD_KIND, 'World kind'), WORLD_PROGRAM,
  shared.declarations);
const material = program.make({...program.baseUniforms(), ...shared.uniforms});

// The square's vertices in the placement's object space, so its transform puts them back on the same world points.
function placed(placement: WorldPlacement): THREE.Object3D {
  const transform = placementTransform(placement), toObject = transform.clone().invert();
  const geometry = new THREE.BufferGeometry().setFromPoints(squareCorners().map(corner =>
    corner.applyMatrix4(toObject)));
  if (placement === WORLD_PLACEMENT.instanced) {
    const instances = new THREE.InstancedMesh(geometry, material, 1);
    instances.setMatrixAt(0, transform);
    return instances;
  }
  if (placement === WORLD_PLACEMENT.batched) {
    const batch = new THREE.BatchedMesh(1, geometry.getAttribute('position').count, undefined, material);
    batch.setMatrixAt(batch.addInstance(batch.addGeometry(geometry)), transform);
    return batch;
  }
  const mesh = new THREE.Mesh(geometry, material);
  transform.decompose(mesh.position, mesh.quaternion, mesh.scale);
  return mesh;
}

window.drawWorldPlacement = placement => {
  const scene = new THREE.Scene(), object = placed(placement);
  scene.add(object);
  const frame = view.readFrame(() => view.renderer.render(scene, camera));
  object.traverse(part => {
    if (part instanceof THREE.Mesh || part instanceof THREE.BatchedMesh) part.geometry.dispose();
  });
  return frame;
};
