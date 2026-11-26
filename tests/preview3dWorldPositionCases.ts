// What preview3dWorldPosition.browser.test.ts and its scene share: one square placed at the same world points under
// each placement, an unlit kind that draws the world position it reads, and the orthographic view that maps each
// pixel to one world point.
import * as THREE from 'three';
import {MODEL_SURFACE_GLSL} from '../src/react/preview3d/surfaceGlsl.ts';
import type {FramePixels} from './pixelReadScene.tsx';

export const WORLD_SCENE_ENTRY = 'tests/preview3dWorldPositionScene.tsx';
export const WORLD_VIEWPORT = Object.freeze({width: 64, height: 64});
/** The world box the view covers, x and y from 0 to `extent` metres, seen down -Z; the square lies at `depth`. */
export const WORLD_VIEW = Object.freeze({extent: 4, depth: 2, eye: 10});
/** The square's corners in world space: x and y from 1 to 3 metres, at the view's depth. */
const SQUARE = Object.freeze({from: 1, to: 3});

// The kind's colour is its world position over the view's extent, so each byte names one world coordinate.
export const WORLD_PROGRAM = `void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse.rgb = ${MODEL_SURFACE_GLSL.world} / ${WORLD_VIEW.extent.toFixed(1)};
}`;
export const WORLD_KIND = Object.freeze({id: 'test-world', parameters: {}, inert: {}, attributes: ['position'],
  light: 'unlit', coverage: 'opaque', side: 'double', fog: false, displacement: null,
  webProgram: {path: '/world.glsl', sha256: 'c'.repeat(64)}});

/** How the square is placed: its vertices as given, or under an object transform, applied as the mesh's own, as one
 * instance's or as one batched geometry's. */
export const WORLD_PLACEMENT = Object.freeze({still: 'still', moved: 'moved', instanced: 'instanced',
  batched: 'batched'} as const);
export type WorldPlacement = (typeof WORLD_PLACEMENT)[keyof typeof WORLD_PLACEMENT];
// A transform that changes every column of the object's world matrix: a translation, a turn about an oblique axis
// and an uneven scale.
const TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 2, 3).normalize(), 1.1);
const MOVE = new THREE.Matrix4().compose(new THREE.Vector3(-3, 5, 1.5), TURN, new THREE.Vector3(0.5, 2, 1.25));

/** The square's world corners, as two triangles. */
export function squareCorners(): THREE.Vector3[] {
  const {from, to} = SQUARE, z = WORLD_VIEW.depth;
  return [[from, from], [to, from], [to, to], [from, from], [to, to], [from, to]]
    .map(([x, y]) => new THREE.Vector3(x, y, z));
}
/** The object transform a placement draws the square under; its vertices are the corners through its inverse. */
export const placementTransform = (placement: WorldPlacement) =>
  placement === WORLD_PLACEMENT.still ? new THREE.Matrix4() : MOVE.clone();

/** The colour bytes a pixel of the square shows: the world point at its centre over the extent. */
export function expectedBytes(x: number, y: number): readonly number[] {
  const {extent, depth} = WORLD_VIEW, world = [x, y].map(at => (at + 0.5) / WORLD_VIEWPORT.width * extent);
  return [...world, depth].map(coordinate => Math.round(coordinate / extent * 255));
}

declare global {
  interface Window {
    drawWorldPlacement(placement: WorldPlacement): FramePixels;
  }
}
