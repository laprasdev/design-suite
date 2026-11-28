// What a stage path allocates per tick in Chromium: the bytes of ticks run with the path, less the bytes of the same
// ticks run without it, sampled by V8's heap profiler with the objects minor and major GCs collected, and held to its
// owner's ceiling in scripts/allocation-baseline.json. The scene runs `ticks` synchronously for either variant.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Page} from '../scripts/gateTools/node_modules/playwright/index.js';
import {ALLOCATION_BASELINE} from '../scripts/baseline/allocationBaseline.ts';
import {isRecord} from '../src/valueChecks.ts';
import {SUITE_ROOT} from './bundled.ts';

// Unsampled passes of `warmTicks` each way first, so V8 has compiled the path before any run is sampled.
export const ALLOCATION_PROFILE = Object.freeze({ticks: 4000, pairs: 2, samplingIntervalBytes: 64, warmPasses: 6,
  warmTicks: 2500});
const {ticks, pairs, samplingIntervalBytes, warmPasses, warmTicks} = ALLOCATION_PROFILE;

function nodeFunctionName(node: unknown): string {
  if (!isRecord(node) || !isRecord(node.callFrame)) return '';
  return typeof node.callFrame.functionName === 'string' ? node.callFrame.functionName : '';
}
function sumProfileBytes(node: unknown): number {
  if (!isRecord(node)) return 0;
  let total = typeof node.selfSize === 'number' ? node.selfSize : 0;
  if (Array.isArray(node.children)) {
    for (const child of node.children) total += sumProfileBytes(child);
  }
  return total;
}
/** The bytes a sampled profile puts on functions named `target`, or only on those under one named `parentName`. */
export function sumNamedBytes(node: unknown, target: string, underParent = true, parentName?: string): number {
  if (!isRecord(node)) return 0;
  const name = nodeFunctionName(node);
  const inside = underParent || name === parentName;
  let total = inside && name === target && typeof node.selfSize === 'number' ? node.selfSize : 0;
  if (Array.isArray(node.children)) {
    for (const child of node.children) total += sumNamedBytes(child, target, inside, parentName);
  }
  return total;
}
/** The bytes a sampled profile puts on every function named `target` under one named `parentName`, with everything
 * each calls: what a callee allocates (a builtin's `new Set`, an inlined helper) is the caller's too. */
export function sumNamedSubtreeBytes(node: unknown, target: string, parentName: string): number {
  const within = (at: unknown, inside: boolean): number => {
    if (!isRecord(at)) return 0;
    const name = nodeFunctionName(at), under = inside || name === parentName;
    if (under && name === target) return sumProfileBytes(at);
    return Array.isArray(at.children) ? at.children.reduce((sum: number, child) => sum + within(child, under), 0) : 0;
  };
  return within(node, false);
}

/** Functions on the measured path whose sampled bytes, with all they call, under `parent`, are another owner's: a
 * dependency's own allocation, held to that owner's ceiling apart from the path's owner. */
export interface AllocationDelegate {
  readonly owner: string;
  readonly parent: string;
  readonly functions: readonly string[];
}
/** How a scene runs its ticks with or without the path measured, what each sampled run with it must hold, and the
 * owners its delegated functions' bytes are charged to (none when the path owns every byte). */
export interface AllocationProfileRun {
  readonly run: (withPath: boolean, count: number) => Promise<void>;
  readonly inspect: (head: unknown) => void;
  readonly delegates: readonly AllocationDelegate[];
}
const mean = (values: readonly number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const ceilingOf = (owner: string) => {
  const ceiling = ALLOCATION_BASELINE.read(join(SUITE_ROOT, ALLOCATION_BASELINE.file)).files[owner];
  assert.ok(ceiling !== undefined, `${ALLOCATION_BASELINE.file} must record a ceiling for ${owner}`);
  return ceiling.extraBytesPerTick;
};
const delegatedBytes = (head: unknown, {parent, functions}: AllocationDelegate) =>
  functions.reduce((sum, name) => sum + sumNamedSubtreeBytes(head, name, parent), 0);

/**
 * Warms the path, measures `owner`'s extra bytes a tick (less what its delegates' functions allocate, each measured
 * and held as its own owner's), writes the report to `captures`, and refuses any measure above its owner's ceiling.
 */
export async function checkAllocationCeiling(page: Page, owner: string, captures: string, path: AllocationProfileRun) {
  for (let pass = 0; pass < warmPasses; pass++) {
    await path.run(false, warmTicks);
    await path.run(true, warmTicks);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  const sampleRun = async (withPath: boolean) => {
    await cdp.send('HeapProfiler.startSampling', {samplingInterval: samplingIntervalBytes,
      includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true});
    await path.run(withPath, ticks);
    const {profile} = await cdp.send('HeapProfiler.stopSampling');
    return {bytesPerTick: Math.round(sumProfileBytes(profile.head) / ticks), head: profile.head};
  };
  // One sampled pair after HeapProfiler.enable, so its sampling trampolines settle before recording.
  await sampleRun(false);
  await sampleRun(true);
  const withoutRuns: number[] = [], withRuns: number[] = [];
  const delegatedRuns = path.delegates.map((): number[] => []);
  for (let pair = 0; pair < pairs; pair++) {
    withoutRuns.push((await sampleRun(false)).bytesPerTick);
    const withSample = await sampleRun(true);
    withRuns.push(withSample.bytesPerTick);
    path.delegates.forEach((delegate, index) =>
      delegatedRuns[index].push(Math.round(delegatedBytes(withSample.head, delegate) / ticks)));
    path.inspect(withSample.head);
  }
  const delegates = path.delegates.map(({owner: delegateOwner, functions}, index) => ({owner: delegateOwner,
    functions, bytesPerTick: delegatedRuns[index], extraBytesPerTick: mean(delegatedRuns[index]),
    ceilingExtraBytesPerTick: ceilingOf(delegateOwner)}));
  const delegated = delegates.reduce((sum, {extraBytesPerTick}) => sum + extraBytesPerTick, 0);
  const extraBytesPerTick = mean(withRuns) - mean(withoutRuns) - delegated;
  const report = {owner, ticksPerRun: ticks, pairs, samplingIntervalBytes, includeObjectsCollectedByMinorGC: true,
    includeObjectsCollectedByMajorGC: true, withoutBytesPerTick: withoutRuns, withBytesPerTick: withRuns,
    withoutMeanBytesPerTick: mean(withoutRuns), withMeanBytesPerTick: mean(withRuns), extraBytesPerTick,
    ceilingExtraBytesPerTick: ceilingOf(owner), delegates};
  writeFileSync(join(captures, 'allocation-profile.json'), `${JSON.stringify(report, null, 2)}\n`);
  for (const measured of [report, ...delegates]) {
    assert.ok(measured.extraBytesPerTick <= measured.ceilingExtraBytesPerTick, `${measured.owner} allocated ` +
      `${measured.extraBytesPerTick} B/tick above ceiling ${measured.ceilingExtraBytesPerTick}`);
  }
  return report;
}
