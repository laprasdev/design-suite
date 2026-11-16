// The size gate's baseline: what it covers, the numbers of each file over a limit, and the allowances granted.
// The numbers only fall, except through an allowance that a step records for import lines its split added.
import { readFileSync, writeFileSync } from 'node:fs';
import { isRecord, isStringList } from '../../src/valueChecks.ts';
import { withinLimits } from './compare.ts';
import {
  FILE_LINE_LIMIT,
  type AllowanceGrant, type AllowanceRecord, type AllowanceSpan, type BaselineNumbers,
  type FileMeasurement, type SizeBaseline, type SizeScope,
} from './limits.ts';

const numbersOf = ({ lines, longLines, importLines }: BaselineNumbers): BaselineNumbers =>
  ({ lines, longLines, importLines });


const isNumbers = (value: unknown): value is BaselineNumbers =>
  isRecord(value) && typeof value.lines === 'number' && typeof value.longLines === 'number'
  && typeof value.importLines === 'number';

const isSpan = (value: unknown): value is AllowanceSpan =>
  isRecord(value) && typeof value.lines === 'number' && typeof value.importLines === 'number';

const isAllowance = (value: unknown): value is AllowanceRecord =>
  isRecord(value) && typeof value.path === 'string' && typeof value.step === 'string'
  && typeof value.reason === 'string' && typeof value.date === 'string' && isSpan(value.from) && isSpan(value.to);

function parseBaseline(value: unknown, file: string): SizeBaseline {
  const invalid = (): never => {
    const needs = 'scope {dirs, files, extensions, skip}, files and allowances';
    throw new Error(`size-gate: ${file} isn't a baseline: it needs ${needs}.`);
  };
  if (!isRecord(value)) return invalid();
  const { scope, files, allowances } = value;
  if (!isRecord(scope) || !isRecord(scope.skip)) return invalid();
  if (!isStringList(scope.dirs) || !isStringList(scope.files) || !isStringList(scope.extensions)) return invalid();
  if (!isStringList(scope.skip.directories) || !isStringList(scope.skip.suffixes)) return invalid();
  if (!isRecord(files) || !Array.isArray(allowances) || !allowances.every(isAllowance)) return invalid();
  const parsedFiles: Record<string, BaselineNumbers> = {};
  for (const [entry, numbers] of Object.entries(files)) {
    if (!isNumbers(numbers)) return invalid();
    parsedFiles[entry] = numbers;
  }
  return {
    scope: {
      dirs: scope.dirs, files: scope.files, extensions: scope.extensions,
      skip: { directories: scope.skip.directories, suffixes: scope.skip.suffixes },
    },
    files: parsedFiles,
    allowances,
  };
}

export function readBaseline(file: string): SizeBaseline {
  return parseBaseline(JSON.parse(readFileSync(file, 'utf8')), file);
}

/** One line per baselined file, so a ratchet's diff reads file by file. */
export function writeBaseline(file: string, baseline: SizeBaseline): void {
  const entries = Object.entries(baseline.files).sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([entry, numbers]) => `    ${JSON.stringify(entry)}: ${JSON.stringify(numbers)}`);
  const allowances = baseline.allowances.map(allowance => `    ${JSON.stringify(allowance)}`);
  const list = (lines: readonly string[], open: string, close: string): string =>
    lines.length ? `${open}\n${lines.join(',\n')}\n  ${close}` : `${open}${close}`;
  const text = `{\n  "scope": ${JSON.stringify(baseline.scope)},\n  "files": ${list(entries, '{', '}')},\n`
    + `  "allowances": ${list(allowances, '[', ']')}\n}\n`;
  writeFileSync(file, text);
}

/** A first baseline: every file in scope that's over a limit today. */
export function freshBaseline(scope: SizeScope, measuredFiles: ReadonlyMap<string, FileMeasurement>): SizeBaseline {
  const over = [...measuredFiles].filter(([, measured]) => !withinLimits(measured));
  const files = Object.fromEntries(over.map(([file, measured]) => [file, numbersOf(measured)]));
  return { scope, files, allowances: [] };
}

/** Lines and import lines move together, so the two always describe one version of the file. */
function lowered(base: BaselineNumbers, measured: FileMeasurement): BaselineNumbers {
  const fell = measured.lines < base.lines;
  return {
    lines: fell ? measured.lines : base.lines,
    longLines: Math.min(base.longLines, measured.longLines),
    importLines: fell ? measured.importLines : base.importLines,
  };
}

/** The lower numbers, with files that now pass or are gone dropped, and their allowances with them. */
export function ratcheted(
  baseline: SizeBaseline,
  measuredFiles: ReadonlyMap<string, FileMeasurement>,
): SizeBaseline {
  const files: Record<string, BaselineNumbers> = {};
  for (const [file, base] of Object.entries(baseline.files)) {
    const measured = measuredFiles.get(file);
    if (measured && !withinLimits(measured)) files[file] = lowered(base, measured);
  }
  const allowances = baseline.allowances.filter(allowance => files[allowance.path]);
  return { ...baseline, files, allowances };
}

/** The baselined and measured numbers an allowance raises from and to; throws, naming why, when none is due. */
function allowanceBasis(
  grant: AllowanceGrant,
  base: BaselineNumbers | undefined,
  measured: FileMeasurement | undefined,
): { base: BaselineNumbers; measured: FileMeasurement } {
  const refuse = (reason: string): never => {
    throw new Error(`size-gate: no allowance for ${grant.path}: ${reason}.`);
  };
  if (!grant.step || !grant.reason) return refuse('an allowance names the step that caused it and why');
  if (!base) return refuse('only a baselined file takes an allowance');
  if (!measured) return refuse('the file is gone');
  const cap = Math.max(FILE_LINE_LIMIT, base.lines);
  if (measured.lines <= cap) return refuse(`it is within its ${cap} lines, so it needs none`);
  if (measured.longLines > base.longLines) return refuse('it gained a long line, which no allowance covers');
  const grown = measured.lines - measured.importLines - (cap - base.importLines);
  return grown > 0 ? refuse(`it grew by ${grown} lines that aren't imports`) : { base, measured };
}

/**
 * Raises one baselined file to its current numbers, for import lines a split added and nothing else, and records the
 * step and the reason. Throws, writing nothing, for any other growth.
 */
export function allowed(
  baseline: SizeBaseline,
  measuredFiles: ReadonlyMap<string, FileMeasurement>,
  grant: AllowanceGrant,
): SizeBaseline {
  const { base, measured } = allowanceBasis(grant, baseline.files[grant.path], measuredFiles.get(grant.path));
  const record: AllowanceRecord = {
    path: grant.path, step: grant.step, reason: grant.reason, date: grant.date,
    from: { lines: base.lines, importLines: base.importLines },
    to: { lines: measured.lines, importLines: measured.importLines },
  };
  const files = { ...baseline.files, [grant.path]: numbersOf(measured) };
  return { ...baseline, files, allowances: [...baseline.allowances, record] };
}
