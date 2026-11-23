// Measured per-tick allocation ceilings (scripts/baseline/baselinedFiles.ts and scripts/baseline/allowance.ts).
// scripts/baseline-gate.ts refuses a rise above the base branch unless an allowance citing the owner's decision admits
// it; this file is lowered by hand from recorded runs until the owner's later binary-frame change removes the cost.
import { isRecord } from '../../src/valueChecks.ts';
import { allowedFilesBaseline, type AllowedFilesBaseline, type DecisionAllowance } from './allowance.ts';

const ALLOCATION_KINDS = ['extraBytesPerTick'] as const;
export type AllocationKind = typeof ALLOCATION_KINDS[number];
export type AllocationAllowance = DecisionAllowance;
export type AllocationBaseline = AllowedFilesBaseline<AllocationKind>;

export const ALLOCATION_BASELINE = allowedFilesBaseline(
  'allocation gate',
  'scripts/allocation-baseline.json',
  ALLOCATION_KINDS,
);

/**
 * Temporary bridge for `origin/main:scripts/allocation-baseline.json`, which holds only `files` until
 * `fix/frame-reading-budget` lands on `main`: reads a base-branch record lacking `allowances` as holding `[]`, while
 * every other reader requires `allowances`. Removed by the next baseline change after `fix/frame-reading-budget`
 * merges to `main` (replacing `parseBaseAllocationBaseline` in scripts/baseline-gate.ts with
 * `ALLOCATION_BASELINE.parse`).
 */
export const parseBaseAllocationBaseline = (value: unknown, file: string): AllocationBaseline =>
  ALLOCATION_BASELINE.parse(
    isRecord(value) && !Object.hasOwn(value, 'allowances') ? { ...value, allowances: [] } : value,
    file,
  );
