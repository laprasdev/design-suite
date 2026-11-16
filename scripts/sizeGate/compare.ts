// The size gate's rules, read against a baseline that only shrinks. Pure: it measures nothing and writes nothing.
import {
  FILE_LINE_LIMIT, LINE_CHARACTER_LIMIT,
  type AllowanceRecord, type AllowanceSpan, type BaselineNumbers, type FileMeasurement, type SizeBaseline,
} from './limits.ts';

/** Within both limits outright, so a baseline has no reason to name it. */
export const withinLimits = (measured: Pick<FileMeasurement, 'lines' | 'longLines'>): boolean =>
  measured.lines <= FILE_LINE_LIMIT && measured.longLines === 0;

/** Rule 1: a file the baseline doesn't name, a moved file included, holds both limits. */
function newFileProblems(file: string, measured: FileMeasurement): string[] {
  const overLines = measured.lines > FILE_LINE_LIMIT
    ? [`${file}: ${measured.lines} lines, over the ${FILE_LINE_LIMIT}-line limit (not baselined)`] : [];
  const overCharacters = measured.long.map(({ line, characters }) =>
    `${file}:${line}: ${characters} characters, over the ${LINE_CHARACTER_LIMIT}-character limit (not baselined)`);
  return [...overLines, ...overCharacters];
}

/** Rule 2: a baselined file gains no long line, and grows past neither the line limit nor its own baselined lines. */
function baselinedProblems(file: string, measured: FileMeasurement, base: BaselineNumbers): string[] {
  const cap = Math.max(FILE_LINE_LIMIT, base.lines);
  const longer = `${file}: ${measured.longLines} lines over ${LINE_CHARACTER_LIMIT} characters, `
    + `baselined ${base.longLines}`;
  const taller = `${file}: ${measured.lines} lines, baselined ${base.lines}, so at most ${cap}`;
  return [...(measured.longLines > base.longLines ? [longer] : []), ...(measured.lines > cap ? [taller] : [])];
}

/** Rule 3: a baselined file that fell, now passes, or is gone says so and passes. */
function ratchetNotice(file: string, measured: FileMeasurement | undefined, base: BaselineNumbers): string[] {
  if (!measured) return [`ratchet: ${file} is gone`];
  if (withinLimits(measured)) return [`ratchet: ${file} now passes at ${measured.lines} lines`];
  if (measured.lines < base.lines || measured.longLines < base.longLines) {
    const now = `${measured.lines} lines and ${measured.longLines} long`;
    return [`ratchet: ${file} is ${now}, baselined ${base.lines} and ${base.longLines}`];
  }
  return [];
}

/**
 * The allowance rule, on the lines an allowance records: raising a file from `from` to `to` adds import lines a split
 * added and nothing else. Says why not, or undefined when it holds.
 */
export function importGrowthRefusal(from: AllowanceSpan, to: AllowanceSpan): string | undefined {
  const cap = Math.max(FILE_LINE_LIMIT, from.lines);
  if (to.lines <= cap) return `it is within its ${cap} lines, so it needs none`;
  const grown = to.lines - to.importLines - (cap - from.importLines);
  return grown > 0 ? `it grew by ${grown} lines that aren't imports` : undefined;
}

/**
 * The allowance rule on a file's whole numbers, which `size-gate --allow` and the baseline gate hold a rise to: no long
 * line, and the import growth above. Says why not, or undefined when it holds.
 */
export const allowanceRefusal = (from: BaselineNumbers, to: BaselineNumbers): string | undefined =>
  to.longLines > from.longLines ? 'it gained a long line, which no allowance covers' : importGrowthRefusal(from, to);

/** Rule 4: each allowance the baseline records holds the allowance rule, so no hand-written record raises a file. */
function allowanceProblems({ path, step, from, to }: AllowanceRecord): string[] {
  const refusal = importGrowthRefusal(from, to);
  return refusal ? [`${path}: the allowance for step ${step} does not hold: ${refusal}`] : [];
}

/**
 * Every problem and notice for the measured files, a Map of path to numbers, against the baseline.
 * Only problems fail; notices say what the ratchet will lower.
 */
export function compare(
  measuredFiles: ReadonlyMap<string, FileMeasurement>,
  baseline: SizeBaseline,
): { problems: string[]; notices: string[] } {
  const problems: string[] = [], notices: string[] = [];
  for (const [file, measured] of measuredFiles) {
    const base = baseline.files[file];
    problems.push(...(base ? baselinedProblems(file, measured, base) : newFileProblems(file, measured)));
  }
  for (const [file, base] of Object.entries(baseline.files)) {
    notices.push(...ratchetNotice(file, measuredFiles.get(file), base));
  }
  problems.push(...baseline.allowances.flatMap(allowanceProblems));
  return { problems, notices };
}
