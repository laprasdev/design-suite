// A baseline holds the numbers of each file a gate lets stand above its limits, and they only fall. The gate refuses a
// file whose numbers grew and, on a pass, writes the lower numbers and drops each file that now holds its limits or is
// gone; scripts/baseline-gate.ts refuses a baseline that rose above the base branch's. The size and cast baselines are
// both read, lowered and written here.
import { isRecord } from '../../src/valueChecks.ts';

/** One file's numbers, each named. */
export type FileNumbers = Readonly<Record<string, number>>;
/** The numbers of each file a baseline names, by path. */
export type BaselinedFiles<Numbers extends FileNumbers> = Readonly<Record<string, Numbers>>;

/**
 * One gate's reading of its numbers: which value is a file's numbers, what holds the limits, what a pass keeps, and
 * when a baseline's numbers rose from another's.
 */
export interface BaselineRule<Numbers extends FileNumbers, Measured> {
  readonly isNumbers: (value: unknown) => value is Numbers;
  readonly withinLimits: (measured: Measured) => boolean;
  readonly lowered: (base: Numbers, measured: Measured) => Numbers;
  readonly rose: (base: Numbers, head: Numbers) => boolean;
}

/** Whether `value` holds a number for each of `kinds`, a file's numbers in a baseline that records those kinds. */
export const holdsNumbers = <Kind extends string>(kinds: readonly Kind[]) =>
  (value: unknown): value is Readonly<Record<Kind, number>> =>
    isRecord(value) && kinds.every(kind => typeof value[kind] === 'number');

/** Each of `kinds` at the lower of the baselined and the measured number. */
export const lowest = <Kind extends string>(kinds: readonly Kind[]) =>
  (base: Readonly<Record<Kind, number>>, measured: Readonly<Record<Kind, number>>): Readonly<Record<Kind, number>> => {
    const lower: Record<Kind, number> = { ...base };
    for (const kind of kinds) lower[kind] = Math.min(base[kind], measured[kind]);
    return lower;
  };

/** Whether any one number is higher in `head`, for numbers that each only fall. */
export const anyRose = <Numbers extends FileNumbers>(base: Numbers, head: Numbers): boolean =>
  Object.entries(head).some(([name, value]) => value > base[name]);

export const OBJECT = ['{', '}'] as const;
export const LIST = ['[', ']'] as const;

/** A baseline's `files`, refused through `invalid` when any entry is not a file's numbers. */
export function parseFiles<Numbers extends FileNumbers>(
  value: unknown,
  isNumbers: (value: unknown) => value is Numbers,
  invalid: () => never,
): BaselinedFiles<Numbers> {
  if (!isRecord(value)) return invalid();
  const files: Record<string, Numbers> = {};
  for (const [file, numbers] of Object.entries(value)) {
    if (!isNumbers(numbers)) return invalid();
    files[file] = numbers;
  }
  return files;
}

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
