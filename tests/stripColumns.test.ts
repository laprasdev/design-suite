// A strip wraps its cells into full rows by the room it has, each column as wide as its heaviest cell needs, and never
// into a single column.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {PHI} from '../src/goldenRatio.ts';
import {stripForm, stripLeastWidth, type StripWrap} from '../src/synth/components/synth/stripColumns.ts';

const LEAST = 100, GAP = 10;
const even = (count: number): StripWrap => ({weights: Array.from({length: count}, () => 1), least: LEAST, gap: GAP});
const FOUR = even(4), SIX = even(6);
const widthOf = (weights: readonly number[]) =>
  LEAST * weights.reduce((sum, weight) => sum + weight, 0) + GAP * (weights.length - 1);
const columnsIn = (room: number, wrap: StripWrap) => stripForm(room, wrap).columns;

describe('a strip that wraps', () => {
  it('keeps one row while every cell keeps its least width', () =>
    assert.equal(columnsIn(widthOf(FOUR.weights), FOUR), 4));
  it('wraps into full rows, never a short one, as the room narrows', () => {
    assert.equal(columnsIn(widthOf(FOUR.weights) - 1, FOUR), 2);
    assert.equal(columnsIn(widthOf(SIX.weights) - 1, SIX), 3);
    assert.equal(columnsIn(widthOf([1, 1, 1]) - 1, SIX), 2);
  });
  it('never stacks to one column: the narrowest form holds whatever the room', () =>
    assert.equal(columnsIn(0, FOUR), 2));
  it('weighs each column by its heaviest cell, in the width it needs and the template it lays', () => {
    const weighted: StripWrap = {...FOUR, weights: [1, 1, PHI, 1]};
    assert.equal(columnsIn(widthOf(FOUR.weights), weighted), 2);
    assert.equal(columnsIn(widthOf(weighted.weights), weighted), 4);
    assert.equal(stripForm(0, weighted).template, `minmax(0, ${PHI}fr) minmax(0, 1fr)`);
    assert.equal(stripLeastWidth(weighted), widthOf([PHI, 1]));
  });
  it('needs its narrowest form\'s width', () => assert.equal(stripLeastWidth(FOUR), widthOf([1, 1])));
  it('refuses a wrap on a count with no narrower full-row form', () => {
    for (const count of [1, 2, 3, 5, 7])
      assert.throws(() => stripForm(0, even(count)), new RegExp(`strip of ${count} cells has no narrower form`));
  });
});
