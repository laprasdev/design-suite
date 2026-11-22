// Measured per-tick allocation ceilings (scripts/baseline/baselinedFiles.ts). scripts/baseline-gate.ts refuses a rise
// above the base branch; this file is lowered by hand from recorded runs until the owner sets each path's budget.
import { filesBaseline } from './baselinedFiles.ts';

export const ALLOCATION_BASELINE = filesBaseline(
  'allocation gate',
  'scripts/allocation-baseline.json',
  ['extraBytesPerTick'] as const,
);
