// The size gate's baseline: what it covers, the numbers of each file over a limit, and the allowances granted.
// The numbers only fall (scripts/baseline/baselinedFiles.ts), except through an allowance that a step records for
// import lines its split added.
import { readFileSync, writeFileSync } from 'node:fs';
import { isRecord, isStringList } from '../../src/valueChecks.ts';
import {
  LIST, OBJECT, baselineText, fileEntries, jsonBlock, parseFiles, ratchetedFiles, type BaselineRule,
} from '../baseline/baselinedFiles.ts';
import { allowanceRefusal, withinLimits } from './compare.ts';
import {
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

/** A size baseline from its decoded JSON; `file` names where it was read, for the refusal. */
export function parseBaseline(value: unknown, file: string): SizeBaseline {
  const invalid = (): never => {
    const needs = 'scope {dirs, files, extensions, skip}, files and allowances';
    throw new Error(`size-gate: ${file} isn't a baseline: it needs ${needs}.`);
  };
  if (!isRecord(value)) return invalid();
  const { scope, allowances } = value;
  if (!isRecord(scope) || !isRecord(scope.skip)) return invalid();
  if (!isStringList(scope.dirs) || !isStringList(scope.files) || !isStringList(scope.extensions)) return invalid();
  if (!isStringList(scope.skip.directories) || !isStringList(scope.skip.suffixes)) return invalid();
  if (!Array.isArray(allowances) || !allowances.every(isAllowance)) return invalid();
  return {
    scope: {
      dirs: scope.dirs, files: scope.files, extensions: scope.extensions,
      skip: { directories: scope.skip.directories, suffixes: scope.skip.suffixes },
    },
    files: parseFiles(value.files, isNumbers, invalid),
    allowances,
  };
}

export function readBaseline(file: string): SizeBaseline {
  return parseBaseline(JSON.parse(readFileSync(file, 'utf8')), file);
}

export const sizeBaselineText = (baseline: SizeBaseline): string => baselineText({
  scope: JSON.stringify(baseline.scope),
  files: jsonBlock(fileEntries(baseline.files), OBJECT),
  allowances: jsonBlock(baseline.allowances.map(allowance => JSON.stringify(allowance)), LIST),
});

export const writeBaseline = (file: string, baseline: SizeBaseline): void =>
  writeFileSync(file, sizeBaselineText(baseline));

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

/** Import lines may rise as a file's lines fall, since they move together; the lines that are not imports may not. */
const rose = (base: BaselineNumbers, head: BaselineNumbers): boolean => head.lines > base.lines
  || head.longLines > base.longLines || head.lines - head.importLines > base.lines - base.importLines;

export const SIZE_RULE: BaselineRule<BaselineNumbers, FileMeasurement> = { isNumbers, withinLimits, lowered, rose };

/** The lower numbers, with files that now pass or are gone dropped, and their allowances with them. */
export function ratcheted(
  baseline: SizeBaseline,
  measuredFiles: ReadonlyMap<string, FileMeasurement>,
): SizeBaseline {
  const files = ratchetedFiles(baseline.files, measuredFiles, SIZE_RULE);
  const allowances = baseline.allowances.filter(allowance => Object.hasOwn(files, allowance.path));
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
  const refusal = allowanceRefusal(base, measured);
  return refusal ? refuse(refusal) : { base, measured };
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
