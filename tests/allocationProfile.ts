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

/** How a scene runs its ticks with or without the path measured, and what each sampled run with it must hold. */
export interface AllocationProfileRun {
  readonly run: (withPath: boolean, count: number) => Promise<void>;
  readonly inspect: (head: unknown) => void;
}
const mean = (values: readonly number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

/**
 * Warms the path, measures `owner`'s extra bytes a tick, writes the report to `captures`, and refuses a measure above
 * the owner's ceiling, before any sampled run is inspected: the ceiling is the guard, and its reading is kept whatever
 * an inspection finds.
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
  const withoutRuns: number[] = [], withRuns: number[] = [], withHeads: unknown[] = [];
  for (let pair = 0; pair < pairs; pair++) {
    withoutRuns.push((await sampleRun(false)).bytesPerTick);
    const withSample = await sampleRun(true);
    withRuns.push(withSample.bytesPerTick);
    withHeads.push(withSample.head);
  }
  const extraBytesPerTick = mean(withRuns) - mean(withoutRuns);
  const ceiling = ALLOCATION_BASELINE.read(join(SUITE_ROOT, ALLOCATION_BASELINE.file)).files[owner];
  assert.ok(ceiling !== undefined, `${ALLOCATION_BASELINE.file} must record a ceiling for ${owner}`);
  const report = {owner, ticksPerRun: ticks, pairs, samplingIntervalBytes, includeObjectsCollectedByMinorGC: true,
    includeObjectsCollectedByMajorGC: true, withoutBytesPerTick: withoutRuns, withBytesPerTick: withRuns,
    withoutMeanBytesPerTick: mean(withoutRuns), withMeanBytesPerTick: mean(withRuns), extraBytesPerTick,
    ceilingExtraBytesPerTick: ceiling.extraBytesPerTick};
  writeFileSync(join(captures, 'allocation-profile.json'), `${JSON.stringify(report, null, 2)}\n`);
  assert.ok(extraBytesPerTick <= ceiling.extraBytesPerTick, `${owner} allocated ${extraBytesPerTick} B/tick above ` +
    `ceiling ${ceiling.extraBytesPerTick} (${withRuns.join(', ')} with, ${withoutRuns.join(', ')} without)`);
  for (const head of withHeads) path.inspect(head);
  return report;
}
