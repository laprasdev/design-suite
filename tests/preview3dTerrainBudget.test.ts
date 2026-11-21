import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {MODEL_TERRAIN_REFUSAL, ModelStageRefusal, modelTerrainChunkTriangles} from '../src/react/preview3d/model.ts';

describe('modelTerrainChunkTriangles', () => {
  it('accepts a whole number of at least one cell\'s two triangles and refuses smaller or non-integer values by name',
    () => {
      assert.equal(modelTerrainChunkTriangles(2, 'budget.chunkTriangles'), 2);
      assert.equal(modelTerrainChunkTriangles(12500, 'budget.chunkTriangles'), 12500);
      for (const bad of [1, 0, -4, 2.5, Number.NaN, '12500', null, undefined]) {
        assert.throws(() => modelTerrainChunkTriangles(bad, 'budget.chunkTriangles'), (error: unknown) =>
          error instanceof ModelStageRefusal && error.message === MODEL_TERRAIN_REFUSAL.chunk('budget.chunkTriangles'));
      }
    });
});
