// What the terrain's browser scene and its test share: the page's ids and routes, the ground kind's program, the
// rolling grid with a hollow it draws, and what the scene reports back.
import {MODEL_TERRAIN_SAMPLE, MODEL_TERRAIN_SPLIT} from '../src/react/preview3d/terrainModel.ts';

export const TERRAIN_SCENE_ENTRY = 'tests/preview3dTerrainScene.tsx';
export const TERRAIN_HOST_ID = 'terrain-stage-host';
export const TERRAIN_ROUTES = Object.freeze({box: 'http://scene.local/box.glb',
  program: 'http://scene.local/ground.glsl'});
export const GROUND_KIND_ID = 'test-ground';
export const GROUND_ACTOR_ID = 'ground';
export const GROUND_PROGRAM = `void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse.rgb = surfaceParameter_Color().rgb;
}`;
// The look's two views by name, as the shared Design rules judge them; its cost is measured at the desktop view.
export const TERRAIN_VIEWPORTS = Object.freeze({desktop: Object.freeze({width: 1440, height: 900}),
  phone: Object.freeze({width: 390, height: 844})});
export type TerrainViewport = typeof TERRAIN_VIEWPORTS[keyof typeof TERRAIN_VIEWPORTS];
// The grids whose cost is measured, samples per side, and the grid the captures draw: the smallest measured, a real
// grid of several chunks, so a chunk border is in the picture.
export const MEASURED_SIDES = Object.freeze([177, 257]);
export const CAPTURED_SIDE = Math.min(...MEASURED_SIDES);
export const TERRAIN_EXTENT = 24;
export const TERRAIN_RELIEF = 1.5;
export const CHUNK_TRIANGLES = 32768;

/** Rolling ground with a round hollow at its centre, its samples spanning the sample range's most, each
 * `TERRAIN_RELIEF / MODEL_TERRAIN_SAMPLE.most` m. */
export function rollingTerrain(side: number) {
  const heights: number[] = [];
  for (let row = 0; row < side; row++) for (let column = 0; column < side; column++) {
    const [x, z] = [row / (side - 1) - 0.5, column / (side - 1) - 0.5], radius = Math.hypot(x, z);
    const rolling = 0.45 * Math.sin(x * 11) * Math.cos(z * 9) + 0.25 * Math.sin((x + z) * 23);
    const hollow = -0.8 * Math.max(0, 1 - radius / 0.18) ** 2;
    heights.push(Math.round(Math.max(-1, Math.min(1, rolling + hollow)) * MODEL_TERRAIN_SAMPLE.most));
  }
  return {resolution: [side, side], size: [TERRAIN_EXTENT, TERRAIN_EXTENT],
    heightScale: TERRAIN_RELIEF / MODEL_TERRAIN_SAMPLE.most,
    heights, split: MODEL_TERRAIN_SPLIT.ascending, chunkTriangles: CHUNK_TRIANGLES};
}

// How often each cost is taken, its median reported: whole applies of a grid, and frames timed and counted per apply.
export const MEASURE_RUNS = 9;
export const FRAMES_TIMED = 120;

/** A grid's costs on one stage, each the median of `MEASURE_RUNS`: applying its description, building its actor's
 * identity key and the refit's comparison of two descriptions holding it, a frame's interval, and a frame's draw calls
 * (every `draw*` the canvas's WebGL2 context ran, the glow's passes included). */
export interface TerrainMeasure {
  readonly side: number;
  readonly applyMilliseconds: number;
  readonly identityMilliseconds: number;
  readonly refitMilliseconds: number;
  readonly frameMilliseconds: number;
  readonly drawCalls: number;
  readonly renderedModelMeshes: number;
}
export interface TerrainSceneDriver {
  /** Shows the box alone, or on a terrain of `side` samples per side, and gives the meshes a settled frame draws. */
  show(side: number | null): Promise<number>;
  measure(side: number): Promise<TerrainMeasure>;
  /** The GL renderer the page draws with, as its debug extension names it. */
  renderer(): string;
}
declare global {
  interface Window {
    makeBoxGlbBytes(): Promise<number[]>;
    /** Boots the stage with its floor aid on or off: a terrain is the ground, so no floor disc is drawn over it. */
    bootTerrainScene(programSha256: string, floor: boolean): Promise<void>;
    terrainScene: TerrainSceneDriver;
  }
}
