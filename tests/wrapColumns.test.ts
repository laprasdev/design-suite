import test from 'node:test';
import assert from 'node:assert/strict';
import {evenColumns,squarestColumns} from '../src/react/useWrapColumns.ts';

const CELL = 20, GAP = 8;

test('24 cells in a width that fits 14 sit as two rows of 12', () => {
  assert.equal(evenColumns(24, 14 * CELL + 13 * GAP, CELL, GAP), 12);
});
test('a width that fits 9 of 24 evens to three rows of 8', () => {
  assert.equal(evenColumns(24, 9 * CELL + 8 * GAP, CELL, GAP), 8);
});
test('a width narrower than one cell still holds one column, and one that fits every cell holds one row', () => {
  assert.equal(evenColumns(5, 1, CELL, GAP), 1);
  assert.equal(evenColumns(5, 1000, CELL, GAP), 5);
});

test('a frame with height to spare takes the columns whose cells are closest to square', () => {
  assert.equal(squarestColumns(24, 429, 182, CELL, 8), 8);
  assert.equal(squarestColumns(24, 429, 182, CELL, 8) === evenColumns(24, 429, CELL, 8), false);
});
test('a frame no taller than its fewest rows keeps them', () => {
  const fewest = evenColumns(24, 429, CELL, 8);
  assert.equal(squarestColumns(24, 429, 2 * CELL + 8, CELL, 8), fewest);
});
test('a frame with height to spare never leaves a short last row', () => {
  const columns = squarestColumns(24, 300, 300, CELL, 4);
  assert.equal(24 % columns, 0);
  assert.equal(columns, 6);
});
test('a frame whose height holds no full-row count keeps the evened columns', () => {
  const width = 4 * CELL + 3 * GAP, height = 2 * CELL + GAP;
  assert.equal(squarestColumns(7, width, height, CELL, GAP), 4);
  assert.equal(squarestColumns(7, width, height, CELL, GAP), evenColumns(7, width, CELL, GAP));
});
