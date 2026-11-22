// A baseline holds the numbers of each file a gate lets stand above its limits, and they only fall.
// scripts/baseline-gate.ts refuses any baseline (size, cast or allocation) that rose above the base branch's.
// Deterministic gates (size and cast) lower their baselines through `ratchetedFiles`; sampled allocation ceilings are
// read and formatted here and lowered by hand from recorded runs. Every reader refuses an unknown field by name.
import { readFileSync } from 'node:fs';
import {
  OTHER_FIELDS, fieldsHolding, holdsNumber, holdsRecordOf, holdsShape, refusalBy, type FieldCheck, type Refusal,
} from '../build/fieldChecks.ts';

/** One file's numbers, each named. */
export type FileNumbers = Readonly<Record<string, number>>;
/** The numbers of each file a baseline names, by path. */
export type BaselinedFiles<Numbers extends FileNumbers> = Readonly<Record<string, Numbers>>;

/** A baseline's refusal, which `source` (the gate and the file) begins. */
export const baselineRefusal = (source: string): Refusal => refusalBy(reason => {
  throw new Error(`${source} ${reason}.`);
}, 'the baseline');

/** One gate's reading of its numbers: what holds the limits, what a pass keeps, and when a baseline's numbers rose. */
export interface BaselineRule<Numbers extends FileNumbers, Measured> {
  readonly withinLimits: (measured: Measured) => boolean;
  readonly lowered: (base: Numbers, measured: Measured) => Numbers;
  readonly rose: (base: Numbers, head: Numbers) => boolean;
}

/** A file's numbers in a baseline that records `kinds`: a number for each, and no other field. */
export const holdsNumbers = <Kind extends string>(kinds: readonly Kind[]): FieldCheck<Readonly<Record<Kind, number>>> =>
  holdsShape(fieldsHolding(kinds, holdsNumber), OTHER_FIELDS.refused);

/** Each of `kinds` at the lower of the baselined and the measured number. */
export const lowest = <Kind extends string>(kinds: readonly Kind[]) =>
  (base: Readonly<Record<Kind, number>>, measured: Readonly<Record<Kind, number>>): Readonly<Record<Kind, number>> => {
    const lower: Record<Kind, number> = { ...base };
    for (const kind of kinds) lower[kind] = Math.min(base[kind], measured[kind]);
    return lower;
  };

/** Whether any one number is higher in `head`, for numbers that each only fall. */
const anyRose = <Numbers extends FileNumbers>(base: Numbers, head: Numbers): boolean =>
  Object.entries(head).some(([name, value]) => value > base[name]);

export const OBJECT = ['{', '}'] as const;
export const LIST = ['[', ']'] as const;

/** A JSON object or list of `entries`, one to a line, so a baseline's diff reads entry by entry. */
export const jsonBlock = (entries: readonly string[], [open, close]: typeof OBJECT | typeof LIST): string =>
  entries.length ? `${open}\n${entries.map(entry => `    ${entry}`).join(',\n')}\n  ${close}` : `${open}${close}`;

/** The entries of `files`, sorted by path. */
export const fileEntries = <Numbers extends FileNumbers>(files: BaselinedFiles<Numbers>): string[] =>
  Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([file, numbers]) => `${JSON.stringify(file)}: ${JSON.stringify(numbers)}`);

/** A baseline's text: each member, already JSON, on its own line. */
export function baselineText(members: Readonly<Record<string, string>>): string {
  const lines = Object.entries(members).map(([name, json]) => `  ${JSON.stringify(name)}: ${json}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

/** The lower numbers, with each file that now holds its limits or is gone dropped. */
export function ratchetedFiles<Numbers extends FileNumbers, Measured>(
  files: BaselinedFiles<Numbers>,
  measuredFiles: ReadonlyMap<string, Measured>,
  rule: BaselineRule<Numbers, Measured>,
): BaselinedFiles<Numbers> {
  const kept: Record<string, Numbers> = {};
  for (const [file, base] of Object.entries(files)) {
    const measured = measuredFiles.get(file);
    if (measured !== undefined && !rule.withinLimits(measured)) kept[file] = rule.lowered(base, measured);
  }
  return kept;
}

/** Each file whose numbers rose from `base` to `head`; a file `base` does not name rose from holding its limits. */
export const risenFiles = <Numbers extends FileNumbers>(
  base: BaselinedFiles<Numbers>,
  head: BaselinedFiles<Numbers>,
  rose: (base: Numbers, head: Numbers) => boolean,
): string[] => Object.entries(head)
  .filter(([file, numbers]) => !Object.hasOwn(base, file) || rose(base[file], numbers)).map(([file]) => file);

/** The numeric record a baseline stores per file for `Kind`. */
export type NumbersOf<Kind extends string> = Readonly<Record<Kind, number>>;

/** A baseline whose root record holds only `files`, each naming `Kind` numbers. */
export interface FilesBaseline<Kind extends string> {
  readonly files: BaselinedFiles<NumbersOf<Kind>>;
}

/** One `files`-only numeric baseline: its path, kinds, rise check, parser, reader and formatter. */
export interface FilesBaselineModule<Kind extends string> {
  readonly file: string;
  readonly kinds: readonly Kind[];
  readonly rose: (base: NumbersOf<Kind>, head: NumbersOf<Kind>) => boolean;
  readonly parse: (value: unknown, file: string) => FilesBaseline<Kind>;
  readonly read: (file: string) => FilesBaseline<Kind>;
  readonly format: (baseline: FilesBaseline<Kind>) => string;
}

/** Builds the path, kinds, rise check, parser, reader and formatter for a `files`-only numeric baseline. */
export function filesBaseline<Kind extends string>(
  gate: string,
  file: string,
  kinds: readonly Kind[],
): FilesBaselineModule<Kind> {
  const check: FieldCheck<FilesBaseline<Kind>> = holdsShape(
    { files: holdsRecordOf(holdsNumbers(kinds)) },
    OTHER_FIELDS.refused,
  );
  const parse = (value: unknown, source: string): FilesBaseline<Kind> => {
    check(value, '', baselineRefusal(`${gate}: ${source}`));
    return value;
  };
  return Object.freeze({
    file,
    kinds,
    rose: anyRose,
    parse,
    read: (source: string): FilesBaseline<Kind> => parse(JSON.parse(readFileSync(source, 'utf8')), source),
    format: (baseline: FilesBaseline<Kind>): string =>
      baselineText({ files: jsonBlock(fileEntries(baseline.files), OBJECT) }),
  });
}
