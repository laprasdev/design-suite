import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {MODEL_PREVIEW_QUATERNION_TOLERANCE} from '../src/react/preview3d/presentation.ts';
import {createModelEnvironment, modelEnvironment, MODEL_ENVIRONMENT_GRID}
  from '../src/react/preview3d/environment.ts';

const fixture = () => ({reflectZ: true, plane: {position: [0, 0, 0], size: [24, 32], color: [.2, .3, .4]},
  boxes: [{id: 'pool', position: [-4, .5, -4], size: [2, 1, 2], color: [.55, .65, .8]}]});
test('world geometry reflects its basis without inheriting the avatar half-turn', () => {
  const environment = createModelEnvironment(fixture());
  const pool = environment.group.getObjectByName('pool') as THREE.Mesh;
  assert.deepEqual(pool.position.toArray(), [-4, .5, 4]);
  assert.deepEqual(pool.quaternion.toArray(), [0, 0, 0, 1]);
  assert.deepEqual(new THREE.Box3().setFromObject(pool).getSize(new THREE.Vector3()).toArray(), [2, 1, 2]);
  assert.deepEqual((pool.material as THREE.MeshStandardMaterial).color.toArray(),
    new THREE.Color().setRGB(.55, .65, .8, THREE.SRGBColorSpace).toArray());
  environment.dispose();
});
test('validates all geometry and copies caller data before allocating the scene', () => {
  const source = fixture(), accepted = modelEnvironment(source);
  source.boxes[0].position[0] = 100;
  assert.equal(accepted.boxes[0].position[0], -4);
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const value = fixture(); value.boxes[0].position[1] = invalid;
    assert.throws(() => createModelEnvironment(value), /finite/);
  }
  const duplicate = fixture(); duplicate.boxes.push(duplicate.boxes[0]);
  assert.throws(() => createModelEnvironment(duplicate), /unique/);
  const zero = fixture(); zero.boxes[0].size[0] = 0;
  assert.throws(() => createModelEnvironment(zero), /positive/);
});
test('disposal removes its scene subtree and releases each owned GPU resource once', () => {
  const environment = createModelEnvironment(fixture()), scene = new THREE.Scene();
  scene.add(environment.group);
  let released = 0;
  for (const child of environment.group.children as THREE.Mesh[]) {
    child.geometry.addEventListener('dispose', () => released++);
    (child.material as THREE.Material).addEventListener('dispose', () => released++);
  }
  environment.dispose(); environment.dispose();
  assert.equal(released, 4); assert.equal(scene.children.length, 0); assert.equal(environment.group.children.length, 0);
});
test('sparse geometry, colors and box lists are invalid', () => {
  for (const key of ['position', 'size', 'color'] as const) {
    const value = fixture(); value.boxes[0][key] = new Array(3);
    assert.throws(() => modelEnvironment(value), /finite/);
  }
  const plane = fixture(); plane.plane.size = new Array(2);
  assert.throws(() => modelEnvironment(plane), /finite/);
  const boxes = fixture(); boxes.boxes = new Array(1);
  assert.throws(() => modelEnvironment(boxes), /unique/);
});
test('opt-in world grid follows the supplied plane and preserves metre spacing', () => {
  const value = fixture(), floor = {...value.plane, position: [3, 2, -4], size: [6, 8],
    grid: {spacing: 1, color: [.3, .4, .5]}};
  const environment = createModelEnvironment({...value, plane: floor});
  const lines = environment.group.getObjectByName('plane-grid') as THREE.LineSegments;
  assert.deepEqual(lines.position.toArray(), [3, 2 + MODEL_ENVIRONMENT_GRID.elevation, 4]);
  assert.equal(lines.geometry.getAttribute('position').count, (7 + 9) * 2);
  let released = 0;
  lines.geometry.addEventListener('dispose', () => released++);
  (lines.material as THREE.Material).addEventListener('dispose', () => released++);
  environment.dispose(); assert.equal(released, 2);
  assert.throws(() => modelEnvironment({...value, plane: {...floor, grid: {...floor.grid, spacing: 0}}}), /spacing/);
  assert.throws(() => modelEnvironment({...value, plane: {...floor, grid: {...floor.grid, spacing: .0001}}}), /lines/);
});

test('published box transforms update existing GPU objects with the world basis', () => {
  const value = fixture(), environment = createModelEnvironment(value);
  const mesh = environment.group.getObjectByName(value.boxes[0].id) as THREE.Mesh;
  const geometry = mesh.geometry, material = mesh.material;
  const moved = {...value, boxes: [{...value.boxes[0], position: [2, 3, -4],
    rotationQuaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2]}]};
  assert.equal(environment.update(moved), true);
  assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material);
  assert.deepEqual(mesh.position.toArray(), [2, 3, 4]);
  const expected = [0, -Math.SQRT1_2, 0, Math.SQRT1_2];
  mesh.quaternion.toArray().forEach((value, index) =>
    assert.ok(Math.abs(value - expected[index]) < MODEL_PREVIEW_QUATERNION_TOLERANCE));
  assert.throws(() => environment.update({...moved, boxes: [{...moved.boxes[0], rotationQuaternion: [0, 0, 0, 0]}]}));
  assert.deepEqual(mesh.position.toArray(), [2, 3, 4]);
  assert.equal(environment.update({...value, boxes: [{...value.boxes[0], size: [3, 3, 3]}]}), false);
  assert.equal(mesh.geometry, geometry);
  environment.dispose();
  assert.throws(() => environment.update(value), /disposed/);
});
