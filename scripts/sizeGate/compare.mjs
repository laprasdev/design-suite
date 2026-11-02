// The size gate's rules, read against a baseline that only shrinks. Pure: it measures nothing and writes nothing.
import { FILE_LINE_LIMIT, LINE_CHARACTER_LIMIT } from './limits.mjs';

/** Within both limits outright, so a baseline has no reason to name it. */
export const withinLimits = measured => measured.lines <= FILE_LINE_LIMIT && measured.longLines === 0;

/** Rule 1: a file the baseline doesn't name, a moved file included, holds both limits. */
function newFileProblems(file, measured) {
  const overLines = measured.lines > FILE_LINE_LIMIT
    ? [`${file}: ${measured.lines} lines, over the ${FILE_LINE_LIMIT}-line limit (not baselined)`] : [];
  const overCharacters = measured.long.map(({ line, characters }) =>
    `${file}:${line}: ${characters} characters, over the ${LINE_CHARACTER_LIMIT}-character limit (not baselined)`);
  return [...overLines, ...overCharacters];
}

/** Rule 2: a baselined file gains no long line, and grows past neither the line limit nor its own baselined lines. */
function baselinedProblems(file, measured, base) {
  const cap = Math.max(FILE_LINE_LIMIT, base.lines);
  const longer = `${file}: ${measured.longLines} lines over ${LINE_CHARACTER_LIMIT} characters, `
    + `baselined ${base.longLines}`;
  const taller = `${file}: ${measured.lines} lines, baselined ${base.lines}, so at most ${cap}`;
  return [...(measured.longLines > base.longLines ? [longer] : []), ...(measured.lines > cap ? [taller] : [])];
}

/** Rule 3: a baselined file that fell, now passes, or is gone says so and passes. */
function ratchetNotice(file, measured, base) {
  if (!measured) return [`ratchet: ${file} is gone`];
  if (withinLimits(measured)) return [`ratchet: ${file} now passes at ${measured.lines} lines`];
  if (measured.lines < base.lines || measured.longLines < base.longLines) {
    const now = `${measured.lines} lines and ${measured.longLines} long`;
    return [`ratchet: ${file} is ${now}, baselined ${base.lines} and ${base.longLines}`];
  }
  return [];
}

/**
 * Every problem and notice for the measured files, a Map of path to numbers, against the baseline.
 * Only problems fail; notices say what the ratchet will lower.
 */
export function compare(measuredFiles, baseline) {
  const problems = [], notices = [];
  for (const [file, measured] of measuredFiles) {
    const base = baseline.files[file];
    problems.push(...(base ? baselinedProblems(file, measured, base) : newFileProblems(file, measured)));
  }
  for (const [file, base] of Object.entries(baseline.files)) {
    notices.push(...ratchetNotice(file, measuredFiles.get(file), base));
  }
  return { problems, notices };
}
