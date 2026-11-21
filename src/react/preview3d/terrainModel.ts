import {modelNumbers, modelOption, modelRecord} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// A terrain as the stage draws it: a height grid. Rows run along x and columns along z, a sample's index is
// `row * resolution[1] + column`, and a sample is a whole number whose height in metres is `sample * heightScale`, the
// layout and the integers a physics heightfield stores, so a host's collider and the drawn ground hold one grid. The
// grid spans `size` and is centred on its actor's placement. Its heights stay in metres, on its host's collider, under
// the stage's `real` size rule and `file` origin; another rule moves every actor alike (sizeModel.ts), terrain
// included. Three-free: a host checks a terrain here.
export const MODEL_TERRAIN_SPLIT = Object.freeze({ascending: 'ascending', descending: 'descending'} as const);
/** How each cell is cut in two: along the diagonal on which row and column rise together, or the other one. */
export type ModelTerrainSplit = typeof MODEL_TERRAIN_SPLIT[keyof typeof MODEL_TERRAIN_SPLIT];
export interface ModelStageTerrain {
  /** Samples per side, [along x, along z]. */
  readonly resolution: readonly [number, number];
  /** The full extent in metres, [along x, along z]. */
  readonly size: readonly [number, number];
  /** Metres per whole-number step of a sample. */
  readonly heightScale: number;
  readonly heights: readonly number[];
  readonly split: ModelTerrainSplit;
  /** The most triangles one drawn chunk of the grid holds. */
  readonly chunkTriangles: number;
}
/** A square run of cells drawn as one renderer: its id, and its first and last sample along each axis. */
export interface ModelTerrainChunk {
  readonly id: string;
  readonly rows: readonly [number, number];
  readonly columns: readonly [number, number];
}
/** The whole numbers a sample may be: a 16-bit signed integer, as a physics heightfield stores it. */
export const MODEL_TERRAIN_SAMPLE = Object.freeze({least: -32768, most: 32767});
const TRIANGLES_PER_CELL = 2;
const FIELDS = Object.freeze(['resolution', 'size', 'heightScale', 'heights', 'split', 'chunkTriangles']);
export const MODEL_TERRAIN_REFUSAL = Object.freeze({
  resolution: (where: string) => `${where} is [along x, along z], two whole numbers of at least 2 samples.`,
  heights: (where: string, count: number, stated: number) =>
    `${where} holds resolution x by z samples, ${count}; it holds ${stated}.`,
  sample: (where: string) =>
    `${where} is a whole number from ${MODEL_TERRAIN_SAMPLE.least} to ${MODEL_TERRAIN_SAMPLE.most}.`,
  chunk: (where: string) => `${where} is a whole number of triangles, at least one cell's ${TRIANGLES_PER_CELL}.`,
  positive: (where: string) => `${where} is a finite number greater than 0.`,
});
const refusal = MODEL_TERRAIN_REFUSAL;

/** A drawn chunk's one id, as a terrain's surface names its renderers. */
export const modelTerrainChunkId = (row: number, column: number) => `terrain-chunk:${row}/${column}`;

function resolution(value: unknown, where: string): readonly [number, number] {
  const pair = Array.isArray(value) ? value : [];
  if (pair.length !== 2 || !pair.every(side => Number.isInteger(side) && side >= 2)) {
    throw new ModelStageRefusal(refusal.resolution(where));
  }
  return Object.freeze([pair[0], pair[1]]);
}
function positive(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) {
    throw new ModelStageRefusal(refusal.positive(where));
  }
  return value;
}
function heights(value: unknown, count: number, where: string): readonly number[] {
  const samples: unknown[] = Array.isArray(value) ? Array.from(value) : [];
  if (samples.length !== count) throw new ModelStageRefusal(refusal.heights(where, count, samples.length));
  const {least, most} = MODEL_TERRAIN_SAMPLE;
  samples.forEach((sample, index) => {
    if (!Number.isInteger(sample) || Number(sample) < least || Number(sample) > most) {
      throw new ModelStageRefusal(refusal.sample(`${where}[${index}]`));
    }
  });
  return Object.freeze(samples.map(Number));
}

/** A terrain's chunk-triangle budget, checked: a whole number of at least one cell's two triangles. */
export function modelTerrainChunkTriangles(value: unknown, where: string): number {
  if (!Number.isInteger(value) || Number(value) < TRIANGLES_PER_CELL) {
    throw new ModelStageRefusal(refusal.chunk(where));
  }
  return Number(value);
}

/** A terrain, every field checked and refused by its name. */
export function modelStageTerrain(value: unknown, where: string): ModelStageTerrain {
  const record = modelRecord(value, FIELDS, where);
  const sides = resolution(record.resolution, `${where}.resolution`);
  const size = modelNumbers(record.size, 2, `${where}.size`).map((length, axis) =>
    positive(length, `${where}.size[${axis}]`));
  return Object.freeze({resolution: sides, size: Object.freeze([size[0], size[1]] as const),
    heightScale: positive(record.heightScale, `${where}.heightScale`),
    heights: heights(record.heights, sides[0] * sides[1], `${where}.heights`),
    split: modelOption(record.split, MODEL_TERRAIN_SPLIT, `${where}.split`),
    chunkTriangles: modelTerrainChunkTriangles(record.chunkTriangles, `${where}.chunkTriangles`)});
}

/** The cells per side of a square chunk: the most whose triangles stay within `chunkTriangles`. */
export const modelTerrainChunkCells = (value: Pick<ModelStageTerrain, 'chunkTriangles'>) =>
  Math.floor(Math.sqrt(value.chunkTriangles / TRIANGLES_PER_CELL));

/** The chunks the grid is drawn in, row-major; neighbours share their border samples. */
export function modelTerrainChunks(value: ModelStageTerrain): readonly ModelTerrainChunk[] {
  const cells = modelTerrainChunkCells(value), [rows, columns] = value.resolution;
  const spans = (samples: number) => Array.from({length: Math.ceil((samples - 1) / cells)},
    (_, index) => Object.freeze([index * cells, Math.min((index + 1) * cells, samples - 1)] as const));
  return Object.freeze(spans(rows).flatMap((rowSpan, row) => spans(columns).map((columnSpan, column) =>
    Object.freeze({id: modelTerrainChunkId(row, column), rows: rowSpan, columns: columnSpan}))));
}
