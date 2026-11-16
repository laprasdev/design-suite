// The size rules this repo and the web synth hold their code to.
import {
  OTHER_FIELDS, holdsListOf, holdsRecordOf, holdsShape, holdsString, holdsStringList, type FieldCheck, type ShapeOf,
} from '../fieldChecks.ts';
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

/** Each record of a size baseline, as its fields and their checks; its type and its check derive from it. */
const SKIP_SHAPE = Object.freeze({ directories: holdsStringList, suffixes: holdsStringList });
export type SizeSkip = ShapeOf<typeof SKIP_SHAPE>;

const SCOPE_SHAPE = Object.freeze({
  dirs: holdsStringList, files: holdsStringList, extensions: holdsStringList,
  skip: holdsShape(SKIP_SHAPE, OTHER_FIELDS.refused),
});
export type SizeScope = ShapeOf<typeof SCOPE_SHAPE>;

const ALLOWANCE_SHAPE = Object.freeze({ path: holdsString, step: holdsString, reason: holdsString, date: holdsString });
export type AllowanceGrant = ShapeOf<typeof ALLOWANCE_SHAPE>;

const SIZE_BASELINE_SHAPE = Object.freeze({
  scope: holdsShape(SCOPE_SHAPE, OTHER_FIELDS.refused),
  files: holdsRecordOf(holdsNumbers(SIZE_KINDS)),
  allowances: holdsListOf(holdsShape(ALLOWANCE_SHAPE, OTHER_FIELDS.refused)),
});
export type SizeBaseline = ShapeOf<typeof SIZE_BASELINE_SHAPE>;
export const holdsSizeBaseline: FieldCheck<SizeBaseline> = holdsShape(SIZE_BASELINE_SHAPE, OTHER_FIELDS.refused);
