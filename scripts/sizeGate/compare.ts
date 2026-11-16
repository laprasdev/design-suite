// The size gate's rules, read against a baseline that only shrinks. Pure: it measures nothing and writes nothing.
import {
  FILE_LINE_LIMIT, LINE_CHARACTER_LIMIT,
  type BaselineNumbers, type FileMeasurement, type SizeBaseline,
} from './limits.ts';

/** Within both limits outright, so a baseline has no reason to name it. */
export const withinLimits = (measured: Pick<FileMeasurement, 'lines' | 'longLines'>): boolean =>
  measured.lines <= FILE_LINE_LIMIT && measured.longLines === 0;

/** The lines a baselined file may hold: the line limit, or its baselined lines when it is over it. */
export const lineCap = (base: BaselineNumbers): number => Math.max(FILE_LINE_LIMIT, base.lines);

/** Whether a baselined file's numbers rose from `base` to `head`: a long line more, or lines past its cap. */
export const sizeRose = (base: BaselineNumbers, head: BaselineNumbers): boolean =>
  head.longLines > base.longLines || head.lines > lineCap(base);

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
  const cap = lineCap(base);
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

/** One version of a baselined file: the numbers its baseline records, and the file as measured. */
export interface BaselinedVersion {
  readonly numbers: BaselineNumbers;
  readonly measured: FileMeasurement;
}

/**
 * The allowance rule, which `size-gate --allow` and the baseline gate hold a rise to: raising a file from `from` to
 * `to` adds no long line, and no line but the import lines a split added, as both files measure them, since no
 * baseline records them. Says why not, or undefined when it holds.
 */
export function allowanceRefusal(from: BaselinedVersion, to: BaselinedVersion): string | undefined {
  if (to.numbers.longLines > from.numbers.longLines) return 'it gained a long line, which no allowance covers';
  const cap = lineCap(from.numbers);
  if (to.numbers.lines <= cap) return `it is within its ${cap} lines, so it needs none`;
  const imports = to.measured.importLines - from.measured.importLines;
  const grown = to.numbers.lines - cap - imports;
  return grown > 0 ? `it grew by ${grown} lines that aren't imports` : undefined;
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
  return { problems, notices };
}
