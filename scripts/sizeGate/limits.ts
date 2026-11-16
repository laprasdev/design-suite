// The size rules this repo and the web synth hold their code to.
import { holdsShape, isListOf, isRecordOf, isString, isStringList, type ShapeOf } from '../../src/valueChecks.ts';
import { holdsNumbers } from '../baseline/baselinedFiles.ts';

export const FILE_LINE_LIMIT = 200;
export const LINE_CHARACTER_LIMIT = 120;

export interface LongLine {
  readonly line: number;
  readonly characters: number;
}

/** The numbers a size baseline records of a file over a limit, each a ceiling the file's measurement may not pass. */
export const SIZE_KINDS = ['lines', 'longLines'] as const;
export type BaselineNumbers = Readonly<Record<typeof SIZE_KINDS[number], number>>;

/** A file as read: its baselined numbers, the lines of its import statements, and each line over the limit. */
export interface FileMeasurement extends BaselineNumbers {
  readonly importLines: number;
  readonly long: readonly LongLine[];
}

/** Each record of a size baseline, as its fields and their checks; its type and its reader derive from it. */
export const SKIP_SHAPE = Object.freeze({ directories: isStringList, suffixes: isStringList });
export type SizeSkip = ShapeOf<typeof SKIP_SHAPE>;

export const SCOPE_SHAPE = Object.freeze({
  dirs: isStringList, files: isStringList, extensions: isStringList, skip: holdsShape(SKIP_SHAPE),
});
export type SizeScope = ShapeOf<typeof SCOPE_SHAPE>;
export const isSizeScope = holdsShape(SCOPE_SHAPE);

export const ALLOWANCE_SHAPE = Object.freeze({ path: isString, step: isString, reason: isString, date: isString });
export type AllowanceGrant = ShapeOf<typeof ALLOWANCE_SHAPE>;
export const isAllowance = holdsShape(ALLOWANCE_SHAPE);
export const isBaselineNumbers = holdsNumbers(SIZE_KINDS);

export const SIZE_BASELINE_SHAPE = Object.freeze({
  scope: isSizeScope, files: isRecordOf(isBaselineNumbers), allowances: isListOf(isAllowance),
});
export type SizeBaseline = ShapeOf<typeof SIZE_BASELINE_SHAPE>;
