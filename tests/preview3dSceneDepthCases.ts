// What preview3dSceneDepth.browser.test.ts and its scene share: a perspective view down -Z over an opaque wall, an
// aid (the stage's aids' layer) before it, an opaque panel before the right half and a cut-out panel before the left
// half with a hole in its outer half, a blended veil before all, and nearest, a blended sheet of a kind that reads the
// scene's depth and draws it, with its own depth, as colour.
import {MODEL_SURFACE_GLSL} from '../src/react/preview3d/surfaceGlsl.ts';
import type {FramePixels} from './pixelReadScene.tsx';

export const DEPTH_SCENE_ENTRY = 'tests/preview3dSceneDepthScene.tsx';
export const DEPTH_VIEWPORT = Object.freeze({width: 64, height: 64});
/** The camera's planes, and each surface's eye depth in metres: what the colour divides them by is `scale`. */
export const DEPTH_VIEW = Object.freeze({near: 0.5, far: 20, fieldOfView: 60, scale: 10});
export const DEPTH_SURFACE = Object.freeze({wall: 8, aid: 7, cutout: 6, panel: 4, veil: 3, sheet: 2});
/** Where across the view (a fraction of its width) each column the test reads lies, and what lies behind the sheet
 * there: the wall through the cut-out's hole (never the aid before it), the cut-out, and the panel. */
export const DEPTH_COLUMNS = Object.freeze([[0.2, DEPTH_SURFACE.wall], [0.4, DEPTH_SURFACE.cutout],
  [0.8, DEPTH_SURFACE.panel]] as const);
const {sceneDepth, fragmentDepth} = MODEL_SURFACE_GLSL, scale = DEPTH_VIEW.scale.toFixed(1);
export const DEPTH_PROGRAM = `void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse = vec4( ${sceneDepth}() / ${scale}, ${fragmentDepth}() / ${scale}, 0.0, 1.0 );
}`;
export const DEPTH_KIND = Object.freeze({id: 'test-scene-depth', parameters: {}, inert: {}, sceneReads: ['depth'],
  attributes: [], light: 'unlit', coverage: {blend: 'alpha'}, side: 'front', fog: false, displacement: null,
  webProgram: {path: '/depth.glsl', sha256: 'd'.repeat(64)}});
/** The bytes a pixel shows where the scene behind the sheet lies at `behind` metres. */
export const depthBytes = (behind: number) =>
  [behind, DEPTH_SURFACE.sheet, 0].map(metres => Math.round(metres / DEPTH_VIEW.scale * 255));

/** A frame's bytes, and the renderer's state after it: its shadow maps' updating, its colour mask, and the programs it
 * holds after one frame and after a second. */
export interface SceneDepthFrame extends FramePixels {
  readonly shadowsUpdate: boolean;
  readonly colourMask: readonly boolean[];
  readonly programs: readonly number[];
}
declare global {
  interface Window {
    drawSceneDepth(): Promise<SceneDepthFrame>;
  }
}
