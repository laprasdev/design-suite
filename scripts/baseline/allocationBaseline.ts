// Measured per-tick allocation ceilings that only fall (scripts/baseline/baselinedFiles.ts and
// scripts/baseline-gate.ts), until the owner sets the budget for each path.
import { filesBaselineCodec, type FilesBaseline } from './baselinedFiles.ts';

export const ALLOCATION_BASELINE = 'scripts/allocation-baseline.json';
export const ALLOCATION_KINDS = ['extraBytesPerTick'] as const;
export type AllocationKind = typeof ALLOCATION_KINDS[number];
export type AllocationNumbers = Readonly<Record<AllocationKind, number>>;
export type AllocationBaseline = FilesBaseline<AllocationKind>;

const ALLOCATION_CODEC = filesBaselineCodec('allocation gate', ALLOCATION_KINDS);
export const ALLOCATION_RULE = ALLOCATION_CODEC.rule;
export const parseAllocationBaseline = ALLOCATION_CODEC.parse;
export const readAllocationBaseline = ALLOCATION_CODEC.read;
export const allocationBaselineText = ALLOCATION_CODEC.format;
