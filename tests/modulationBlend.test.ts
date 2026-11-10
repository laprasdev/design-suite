import test from 'node:test';
import assert from 'node:assert/strict';
import {ModulationRoot, RangeEnd, type ControlModulator} from '../src/synth/components/synth/modulation.ts';
import {ReachDirection, blendStops, blendedReach} from '../src/react/inputs/modulationBlend.ts';

const source = (depth: number, extra: Partial<ControlModulator> = {}): ControlModulator =>
  ({source: `s${depth}`, root: ModulationRoot.SELF, depth, ...extra});
// A value of 50 on 0 to 100, so a depth is its own percent.
const reach = (modulators: ControlModulator[]) => blendedReach(modulators, 0, 50, 0, 100);

test('one source is one solid line from the value to a circle at its end', () => {
  const {segments, ends} = reach([source(20)]);
  const band = {from: 50, to: 70, sources: [0]};
  assert.deepEqual(segments, [{direction: ReachDirection.UP, from: 50, to: 70, bands: [band]}]);
  assert.deepEqual(ends, [{source: 0, direction: ReachDirection.UP, at: 70, clamped: false, stack: 0}]);
  assert.deepEqual(blendStops(segments[0]), [{at: 0, source: 0}, {at: 100, source: 0}]);
});

test('three sources the same way blend their colours across what they share and fall away at each end', () => {
  const {segments, ends} = reach([source(10), source(20), source(40)]);
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].bands.map(band => [band.from, band.to, band.sources]),
    [[50, 60, [0, 1, 2]], [60, 70, [1, 2]], [70, 90, [2]]]);
  assert.deepEqual(ends.map(end => [end.source, end.at]), [[0, 60], [1, 70], [2, 90]]);
  // 3 and 2 stops across the shared bands, 2 on the last: 7 in all, in the socket's order, hard where a source ends.
  const stops = blendStops(segments[0]);
  assert.deepEqual(stops.map(stop => stop.source), [0, 1, 2, 1, 2, 2, 2]);
  assert.deepEqual(stops.map(stop => Number(stop.at.toFixed(2))), [0, 12.5, 25, 25, 50, 50, 100]);
});

test('sources reaching both ways draw one line each way, and a bipolar source ends in both', () => {
  const {segments, ends} = reach([source(10), source(-20), source(15, {bipolar: true})]);
  assert.deepEqual(segments.map(segment => [segment.direction, segment.from, segment.to]),
    [[ReachDirection.DOWN, 30, 50], [ReachDirection.UP, 50, 65]]);
  assert.deepEqual(segments.map(segment => segment.bands.map(band => [band.from, band.to, band.sources])), [
    [[30, 35, [1]], [35, 50, [1, 2]]], [[50, 60, [0, 2]], [60, 65, [2]]]]);
  assert.deepEqual(segments.map(segment => blendStops(segment).length), [4, 4]);
  assert.deepEqual(ends.map(end => [end.source, end.direction, end.at]), [
    [0, ReachDirection.UP, 60], [1, ReachDirection.DOWN, 30],
    [2, ReachDirection.DOWN, 35], [2, ReachDirection.UP, 65]]);
});

test('a reach past either end of the track stops at that edge, still drawn and marked clamped', () => {
  const {segments, ends} = reach([source(80), source(-80)]);
  assert.deepEqual(ends.map(end => [end.at, end.clamped]), [[100, true], [0, true]]);
  assert.deepEqual(segments.map(segment => [segment.direction, segment.from, segment.to]),
    [[ReachDirection.DOWN, 0, 50], [ReachDirection.UP, 50, 100]]);
  const pinned = blendedReach([source(10)], 0, 100, 0, 100);
  assert.deepEqual(pinned.segments, []);
  assert.deepEqual(pinned.ends, [{source: 0, direction: ReachDirection.UP, at: 100, clamped: true, stack: 0}]);
});

test('ends that stop at one point take places in turn, so each draws apart from the next', () => {
  const {ends} = reach([source(80), source(90), source(-80)]);
  assert.deepEqual(ends.map(end => [end.at, end.stack]), [[100, 0], [100, 1], [0, 0]]);
});

test('no source is no line, and a range end moves its source to that end', () => {
  assert.deepEqual(reach([]), {reaches: [], segments: [], ends: []});
  const origin = blendedReach([source(10, {end: RangeEnd.ORIGIN})], 20, 60, 0, 100);
  assert.deepEqual(origin.ends.map(end => end.at), [30]);
});

test('a depth draws in the control\'s own units, so a full-range reach spans the whole track', () => {
  // Acceleration holds 0 to 300 frames: a depth of 300 from 0 fills the track, 75 is a quarter of it.
  const frames = blendedReach([source(300), source(75)], 0, 0, 0, 300);
  assert.deepEqual(frames.ends.map(end => [end.source, end.at, end.clamped]), [[0, 100, false], [1, 25, false]]);
  assert.deepEqual(frames.segments.map(segment => [segment.from, segment.to]), [[0, 100]]);
});

test('each reach carries its own span and where the current sample puts the value', () => {
  const {reaches} = reach([source(20, {sample: 0.5}), source(10, {bipolar: true, sample: -1}), source(5)]);
  const rows = reaches.map(({source, direction, from, to, live}) => [source, direction, from, Math.round(to), live]);
  assert.deepEqual(rows, [
    [0, ReachDirection.UP, 50, 70, 60], [1, ReachDirection.DOWN, 40, 50, 40], [1, ReachDirection.UP, 50, 60, 40],
    [2, ReachDirection.UP, 50, 55, undefined]]);
});
