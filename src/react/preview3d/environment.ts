import * as THREE from 'three';
import {modelPoseForBinding, type ModelVector} from './placementModel.ts';
import type {ModelColor} from './colorModel.ts';
import {writeModelColor} from './color.ts';
import {MODEL_ENVIRONMENT_GRID, modelEnvironment, type ModelEnvironment, type ModelEnvironmentBox}
  from './environmentModel.ts';
import {extendModelMaterial, type ModelShaderChange} from './shading.ts';

function geometryKey(value: ModelEnvironment) {
  return JSON.stringify({reflectZ: value.reflectZ, plane: value.plane,
    boxes: value.boxes.map(({id, size, color}) => ({id, size, color}))});
}
function positionBox(mesh: THREE.Object3D, box: ModelEnvironmentBox, reflectZ: boolean) {
  const pose = modelPoseForBinding({position: box.position, rotationQuaternion: box.rotationQuaternion ?? [0, 0, 0, 1],
    scale: [1, 1, 1]}, {reflectZ, rotationQuaternion: [0, 0, 0, 1]});
  mesh.position.fromArray(pose.position);
  mesh.quaternion.fromArray(pose.rotationQuaternion);
}

function createGrid(plane: NonNullable<ModelEnvironment['plane']>, fog: ModelShaderChange) {
  const {spacing, color} = plane.grid!, [width, depth] = plane.size, vertices: number[] = [];
  for (let i = 0; i <= Math.floor(width / spacing); i++) {
    const x = -width / 2 + i * spacing;
    vertices.push(x, 0, -depth / 2, x, 0, depth / 2);
  }
  for (let i = 0; i <= Math.floor(depth / spacing); i++) {
    const z = -depth / 2 + i * spacing;
    vertices.push(-width / 2, 0, z, width / 2, 0, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const material = extendModelMaterial(new THREE.LineBasicMaterial(), [fog]);
  writeModelColor(material.color, color);
  return new THREE.LineSegments(geometry, material);
}

// Render supplied geometry only. World coordinates use basis reflection, never the avatar's local alignment. The
// scenery is the scene's: it takes the stage's fog, and its glow and tone curve (never an aid, layers.ts).
export function createModelEnvironment(value: unknown, fog: ModelShaderChange) {
  const environment = modelEnvironment(value);
  const group = new THREE.Group(), boxes = new Map<string, THREE.Mesh>();
  const key = geometryKey(environment);
  const resources: Array<{dispose(): void}> = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    group.removeFromParent();
    for (const resource of resources) resource.dispose();
    group.clear();
    disposed = true;
  };
  const add = (geometry: THREE.BufferGeometry, position: ModelVector, color: ModelColor, id: string) => {
    resources.push(geometry);
    const material = extendModelMaterial(new THREE.MeshStandardMaterial(), [fog]);
    resources.push(material);
    writeModelColor(material.color, color);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = id;
    mesh.position.set(position[0], position[1], environment.reflectZ ? -position[2] : position[2]);
    group.add(mesh);
    return mesh;
  };
  try {
    if (environment.plane) {
      const {size, position, color} = environment.plane;
      add(new THREE.PlaneGeometry(...size), position, color, 'plane').rotation.x = -Math.PI / 2;
      if (environment.plane.grid) {
        const lines = createGrid(environment.plane, fog);
        resources.push(lines.geometry, lines.material);
        lines.name = 'plane-grid';
        lines.position.set(position[0], position[1] + MODEL_ENVIRONMENT_GRID.elevation,
          environment.reflectZ ? -position[2] : position[2]);
        lines.scale.z = environment.reflectZ ? -1 : 1;
        group.add(lines);
      }
    }
    for (const box of environment.boxes) {
      const mesh = add(new THREE.BoxGeometry(...box.size), box.position, box.color, box.id);
      positionBox(mesh, box, environment.reflectZ);
      boxes.set(box.id, mesh);
    }
  } catch (error) {dispose(); throw error;}
  return {group, dispose, update(value: unknown) {
    if (disposed) throw new Error('The preview environment has been disposed.');
    const next = modelEnvironment(value);
    if (geometryKey(next) !== key) return false;
    for (const box of next.boxes) positionBox(boxes.get(box.id)!, box, next.reflectZ);
    return true;
  }};
}
