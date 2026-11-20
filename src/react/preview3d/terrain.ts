import * as THREE from 'three';
import type {ModelDrawn} from './drawn.ts';
import type {ModelRenderer} from './renderers.ts';
import {MODEL_TERRAIN_SPLIT, modelTerrainChunks, type ModelStageTerrain, type ModelTerrainChunk}
  from './terrainModel.ts';

const FLOATS = Object.freeze({position: 3, normal: 3, uv: 2});
// A sample's place along one axis: the grid spans `size`, centred on the terrain's origin.
const along = (sample: number, samples: number, size: number) => -size / 2 + sample * size / (samples - 1);

/** Every sample's normal over the whole grid, from central differences (one-sided at the border), computed once so
 * that the chunks sharing a border sample share its normal bit for bit. */
export function modelTerrainNormals(value: ModelStageTerrain): Float32Array {
  const [rows, columns] = value.resolution, [sizeX, sizeZ] = value.size, {heights, heightScale} = value;
  const normals = new Float32Array(rows * columns * FLOATS.normal), normal = new THREE.Vector3();
  const height = (row: number, column: number) => heights[row * columns + column] * heightScale;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const [r0, r1] = [Math.max(row - 1, 0), Math.min(row + 1, rows - 1)];
    const [c0, c1] = [Math.max(column - 1, 0), Math.min(column + 1, columns - 1)];
    const slopeX = (height(r1, column) - height(r0, column)) / ((r1 - r0) * sizeX / (rows - 1));
    const slopeZ = (height(row, c1) - height(row, c0)) / ((c1 - c0) * sizeZ / (columns - 1));
    normal.set(-slopeX, 1, -slopeZ).normalize().toArray(normals, (row * columns + column) * FLOATS.normal);
  }
  return normals;
}

// One chunk's geometry: its samples, sliced from the grid's normals, and two front-facing (+y) triangles a cell cut
// along the terrain's diagonal.
function chunkGeometry(value: ModelStageTerrain, chunk: ModelTerrainChunk, normals: Float32Array) {
  const [rows, columns] = value.resolution, [sizeX, sizeZ] = value.size;
  const span = (pair: readonly [number, number]) => pair[1] - pair[0] + 1;
  const width = span(chunk.columns), count = span(chunk.rows) * width;
  const position = new Float32Array(count * FLOATS.position), normal = new Float32Array(count * FLOATS.normal);
  const uv = new Float32Array(count * FLOATS.uv);
  for (let row = chunk.rows[0], at = 0; row <= chunk.rows[1]; row++) {
    for (let column = chunk.columns[0]; column <= chunk.columns[1]; column++, at++) {
      const sample = row * columns + column;
      position.set([along(row, rows, sizeX), value.heights[sample] * value.heightScale,
        along(column, columns, sizeZ)], at * FLOATS.position);
      normal.set(normals.subarray(sample * FLOATS.normal, (sample + 1) * FLOATS.normal), at * FLOATS.normal);
      uv.set([row / (rows - 1), column / (columns - 1)], at * FLOATS.uv);
    }
  }
  const index: number[] = [], ascending = value.split === MODEL_TERRAIN_SPLIT.ascending;
  for (let row = 0; row < span(chunk.rows) - 1; row++) for (let column = 0; column < width - 1; column++) {
    // a at (row, column), b one column on (+z), c one row on (+x), d both.
    const a = row * width + column, b = a + 1, c = a + width, d = c + 1;
    index.push(...(ascending ? [a, b, d, a, d, c] : [a, b, c, b, d, c]));
  }
  return new THREE.BufferGeometry().setIndex(index)
    .setAttribute('position', new THREE.BufferAttribute(position, FLOATS.position))
    .setAttribute('normal', new THREE.BufferAttribute(normal, FLOATS.normal))
    .setAttribute('uv', new THREE.BufferAttribute(uv, FLOATS.uv));
}

/** A terrain drawn as one group of chunk meshes, each at identity in the terrain's one object space. It has no clips;
 * its renderers are its chunks by id. */
export function createModelTerrain(value: ModelStageTerrain): ModelDrawn {
  const scene = new THREE.Group(), normals = modelTerrainNormals(value);
  const renderers = new Map<string, ModelRenderer>();
  for (const chunk of modelTerrainChunks(value)) {
    const mesh = new THREE.Mesh(chunkGeometry(value, chunk, normals));
    mesh.name = chunk.id;
    scene.add(mesh);
    renderers.set(chunk.id, mesh);
  }
  return {scene, clips: [], renderers: () => renderers};
}
