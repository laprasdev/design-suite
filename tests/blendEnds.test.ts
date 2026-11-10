import test from 'node:test';
import assert from 'node:assert/strict';
import {ModulationRoot, RangeEnd, type RangeEndValue, type ControlModulator}
  from '../src/synth/components/synth/modulation.ts';
import {blendedReach} from '../src/react/inputs/modulationBlend.ts';
import {blendEndGroups, END_CIRCLE_MIN, END_GAP} from '../src/react/inputs/blendEnds.ts';

const source = (depth: number, end: RangeEndValue = RangeEnd.END): ControlModulator =>
  ({source: `${depth}:${end}`, root: ModulationRoot.SELF, depth, end});
const group = (value: number, depths: number[], width: number) => blendEndGroups(
  blendedReach(depths.map(depth => source(depth)), 0, value, 0, 100), width, END_CIRCLE_MIN);

test('coincident ends use separate circles where their own reaches have room', () => {
  const ends = group(50, [80, 90], 100);
  assert.deepEqual(ends.map(end => end.members.length), [1, 1]);
  assert.deepEqual(ends.map(end => end.at), [100, 100 - END_CIRCLE_MIN - END_GAP]);
});

test('ends at either crowded edge share one circle with every source preserved', () => {
  for (const [value, depths, at] of [[99.5, [80, 90, 100], 100], [0.5, [-80, -90, -100], 0]] as const) {
    const ends = group(value, [...depths], 100);
    assert.equal(ends.length, 1);
    assert.equal(ends[0].at, at);
    assert.deepEqual(ends[0].members.map(end => end.source), [0, 1, 2]);
    assert.ok(ends[0].members.every(end => end.clamped));
  }
});

test('resizing separates the circle only when all of its sources fit', () => {
  assert.equal(group(94, [80, 90], 100).length, 1);
  assert.equal(group(94, [80, 90], 300).length, 2);
  assert.equal(group(94, [80, 90], 0).length, 1);
});

test('sources at the same edge use their own range endpoint to decide room', () => {
  const modulators = [source(100, RangeEnd.ORIGIN), source(100)];
  const ends = blendEndGroups(blendedReach(modulators, 20, 99.5, 0, 100), 100, END_CIRCLE_MIN);
  assert.equal(ends.length, 1);
  assert.deepEqual(ends[0].members.map(end => end.source), [0, 1]);
});

test('different ends remain separate and no bindings produce no circles', () => {
  assert.deepEqual(group(50, [10, 20], 100).map(end => end.at), [60, 70]);
  assert.deepEqual(group(50, [], 100), []);
});
