// The size gate's baseline: what it covers, the numbers of each file over a limit, and the allowances granted.
// The numbers only fall, except through an allowance that a step records for import lines its split added.
import { readFileSync, writeFileSync } from 'node:fs';
import { FILE_LINE_LIMIT } from './limits.mjs';
import { withinLimits } from './compare.mjs';

const numbersOf = ({ lines, longLines, importLines }) => ({ lines, longLines, importLines });

function assertShape(baseline, file) {
  const { scope, files, allowances } = baseline;
  const scoped = scope && ['dirs', 'files', 'extensions'].every(key => Array.isArray(scope[key]))
    && Array.isArray(scope.skip?.directories) && Array.isArray(scope.skip?.suffixes);
  if (!scoped || typeof files !== 'object' || !Array.isArray(allowances)) {
    const needs = 'scope {dirs, files, extensions, skip}, files and allowances';
    throw new Error(`size-gate: ${file} isn't a baseline: it needs ${needs}.`);
  }
}

export function readBaseline(file) {
  const baseline = JSON.parse(readFileSync(file, 'utf8'));
  assertShape(baseline, file);
  return baseline;
}

/** One line per baselined file, so a ratchet's diff reads file by file. */
export function writeBaseline(file, baseline) {
  const entries = Object.entries(baseline.files).sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, numbers]) => `    ${JSON.stringify(path)}: ${JSON.stringify(numbers)}`);
  const allowances = baseline.allowances.map(allowance => `    ${JSON.stringify(allowance)}`);
  const list = (lines, open, close) => (lines.length ? `${open}\n${lines.join(',\n')}\n  ${close}` : `${open}${close}`);
  const text = `{\n  "scope": ${JSON.stringify(baseline.scope)},\n  "files": ${list(entries, '{', '}')},\n`
    + `  "allowances": ${list(allowances, '[', ']')}\n}\n`;
  writeFileSync(file, text);
}

/** A first baseline: every file in scope that's over a limit today. */
export function freshBaseline(scope, measuredFiles) {
  const over = [...measuredFiles].filter(([, measured]) => !withinLimits(measured));
  const files = Object.fromEntries(over.map(([file, measured]) => [file, numbersOf(measured)]));
  return { scope, files, allowances: [] };
}

/** Lines and import lines move together, so the two always describe one version of the file. */
function lowered(base, measured) {
  const fell = measured.lines < base.lines;
  return {
    lines: fell ? measured.lines : base.lines,
    longLines: Math.min(base.longLines, measured.longLines),
    importLines: fell ? measured.importLines : base.importLines,
  };
}

/** The lower numbers, with files that now pass or are gone dropped, and their allowances with them. */
export function ratcheted(baseline, measuredFiles) {
  const files = {};
  for (const [file, base] of Object.entries(baseline.files)) {
    const measured = measuredFiles.get(file);
    if (measured && !withinLimits(measured)) files[file] = lowered(base, measured);
  }
  const allowances = baseline.allowances.filter(allowance => files[allowance.path]);
  return { ...baseline, files, allowances };
}

function allowanceRefusal(grant, base, measured) {
  if (!grant.step || !grant.reason) return 'an allowance names the step that caused it and why';
  if (!base) return 'only a baselined file takes an allowance';
  if (!measured) return 'the file is gone';
  const cap = Math.max(FILE_LINE_LIMIT, base.lines);
  if (measured.lines <= cap) return `it is within its ${cap} lines, so it needs none`;
  if (measured.longLines > base.longLines) return 'it gained a long line, which no allowance covers';
  const grown = measured.lines - measured.importLines - (cap - base.importLines);
  return grown > 0 ? `it grew by ${grown} lines that aren't imports` : null;
}

/**
 * Raises one baselined file to its current numbers, for import lines a split added and nothing else, and records the
 * step and the reason. Throws, writing nothing, for any other growth.
 */
export function allowed(baseline, measuredFiles, grant) {
  const base = baseline.files[grant.path], measured = measuredFiles.get(grant.path);
  const refusal = allowanceRefusal(grant, base, measured);
  if (refusal) throw new Error(`size-gate: no allowance for ${grant.path}: ${refusal}.`);
  const record = {
    path: grant.path, step: grant.step, reason: grant.reason, date: grant.date,
    from: { lines: base.lines, importLines: base.importLines },
    to: { lines: measured.lines, importLines: measured.importLines },
  };
  const files = { ...baseline.files, [grant.path]: numbersOf(measured) };
  return { ...baseline, files, allowances: [...baseline.allowances, record] };
}
