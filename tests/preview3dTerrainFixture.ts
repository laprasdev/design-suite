// A terrain actor for the terrain's own tests and the stage's: a small sloped grid drawn by the test kind's record, one
// cell to a chunk, so it is drawn as two chunks that share their border row, as every real grid is several.
import {MODEL_TERRAIN_SPLIT} from '../src/react/preview3d/terrainModel.ts';
import type {ModelPresentationPose} from '../src/react/preview3d/placementModel.ts';
import {STANDING} from './preview3dActorFixture.ts';
import {record} from './preview3dKindFixture.ts';

export const TERRAIN_GRID = Object.freeze({resolution: [3, 2], size: [4, 2], heightScale: 0.5,
  heights: [0, 2, -2, 4, 6, 8], split: MODEL_TERRAIN_SPLIT.ascending, chunkTriangles: 2});
export const TERRAIN_ID = 'g';
export const terrainActor = (terrain: unknown = TERRAIN_GRID, surface: unknown = record(),
  placement: ModelPresentationPose = STANDING) => ({id: TERRAIN_ID, terrain, placement, surface});
