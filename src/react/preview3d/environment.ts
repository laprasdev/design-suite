import * as THREE from 'three';
import {modelPresentationRotation, modelPoseForBinding, type ModelRotation, type ModelVector}
  from './placementModel.ts';
import {ModelStageRefusal} from './refusal.ts';

export const MODEL_ENVIRONMENT_GRID = Object.freeze({maximumLines: 1024, elevation: 0.001});
export interface ModelEnvironmentBox {
  readonly id: string;
  readonly position: ModelVector;
  readonly size: ModelVector;
  readonly color: ModelVector;
  readonly rotationQuaternion?: ModelRotation;
}
export interface ModelEnvironment {
  readonly reflectZ: boolean;
  readonly plane: {readonly position: ModelVector; readonly size: readonly [number, number];
    readonly color: ModelVector; readonly grid?: {readonly spacing: number; readonly color: ModelVector}} | null;
  readonly boxes: readonly ModelEnvironmentBox[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function numbers(value: unknown, length: number): number[] {
  const copy = Array.isArray(value) ? Array.from(value) : [];
  if (copy.length !== length || !copy.every(Number.isFinite)) {
    throw new ModelStageRefusal('Environment coordinates must contain finite numbers.');
  }
  return copy;
}
function vector(value: unknown): ModelVector {
  return Object.freeze(numbers(value, 3)) as unknown as ModelVector;
}
function dimensions(value: unknown, length: number) {
  const result = numbers(value, length);
  if (result.some(number => number <= 0)) throw new ModelStageRefusal('Environment dimensions must be positive.');
  return result;
}
function tint(value: unknown): ModelVector {
  const result = vector(value);
  if (result.some(number => number < 0 || number > 1)) {
    throw new ModelStageRefusal('Environment colors must be sRGB in [0, 1].');
  }
  return result;
}
function grid(value: unknown, size: readonly number[]) {
  if (value === undefined) return undefined;
  if (!object(value) || typeof value.spacing !== 'number' || !Number.isFinite(value.spacing) || value.spacing <= 0) {
    throw new ModelStageRefusal('Environment grid spacing must be positive and finite.');
  }
  const spacing = value.spacing;
  const count = size.reduce((total, dimension) => total + Math.floor(dimension / spacing) + 1, 0);
  if (count > MODEL_ENVIRONMENT_GRID.maximumLines) throw new ModelStageRefusal('Environment grid has too many lines.');
  return Object.freeze({spacing, color: tint(value.color)});
}
export function modelEnvironment(value: unknown): ModelEnvironment {
  if (!object(value) || typeof value.reflectZ !== 'boolean' || !Array.isArray(value.boxes) ||
    (value.plane !== null && !object(value.plane))) {
    throw new ModelStageRefusal('A complete preview environment is required.');
  }
  const ids = new Set<string>();
  const boxes = Array.from(value.boxes, box => {
    if (!object(box) || typeof box.id !== 'string' || !box.id || ids.has(box.id)) {
      throw new ModelStageRefusal('Environment boxes require unique IDs.');
    }
    ids.add(box.id);
    return Object.freeze({id: box.id, position: vector(box.position), color: tint(box.color),
      size: Object.freeze(dimensions(box.size, 3)) as unknown as ModelVector,
      ...(box.rotationQuaternion !== undefined && {
        rotationQuaternion: modelPresentationRotation(box.rotationQuaternion),
      })});
  });
  const size = value.plane === null ? null :
    Object.freeze(dimensions(value.plane.size, 2)) as readonly [number, number];
  const plane = value.plane === null ? null : Object.freeze({position: vector(value.plane.position),
    color: tint(value.plane.color), size: size!, grid: grid(value.plane.grid, size!)});
  return Object.freeze({reflectZ: value.reflectZ, plane, boxes: Object.freeze(boxes)});
}

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

function createGrid(plane: NonNullable<ModelEnvironment['plane']>) {
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
  const material = new THREE.LineBasicMaterial();
  material.color.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace);
  return new THREE.LineSegments(geometry, material);
}

// Render supplied geometry only. World coordinates use basis reflection, never the avatar's local alignment.
export function createModelEnvironment(value: unknown) {
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
  const add = (geometry: THREE.BufferGeometry, position: ModelVector, color: ModelVector, id: string) => {
    resources.push(geometry);
    const material = new THREE.MeshStandardMaterial();
    resources.push(material);
    material.color.setRGB(color[0], color[1], color[2], THREE.SRGBColorSpace);
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
        const lines = createGrid(environment.plane);
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
