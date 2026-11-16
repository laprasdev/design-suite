// The size gate's baseline: what it covers, the numbers of each file over a limit, and the allowances granted.
// The numbers only fall (scripts/baseline/baselinedFiles.ts), except through an allowance that a step records for
// import lines its split added. It records no import lines: the allowance rule measures them in both files.
import { readFileSync, writeFileSync } from 'node:fs';
import { isRecord, isStringList } from '../../src/valueChecks.ts';
import {
  LIST, OBJECT, baselineText, fileEntries, holdsNumbers, jsonBlock, lowest, parseFiles, ratchetedFiles,
  type BaselineRule,
} from '../baseline/baselinedFiles.ts';
import { allowanceRefusal, sizeRose, withinLimits } from './compare.ts';
import {
  SIZE_KINDS, type AllowanceGrant, type BaselineNumbers, type FileMeasurement, type SizeBaseline, type SizeScope,
} from './limits.ts';

const numbersOf = ({ lines, longLines }: BaselineNumbers): BaselineNumbers => ({ lines, longLines });
const grantOf = ({ path, step, reason, date }: AllowanceGrant): AllowanceGrant => ({ path, step, reason, date });

export const SIZE_RULE: BaselineRule<BaselineNumbers, FileMeasurement> = {
  isNumbers: holdsNumbers(SIZE_KINDS), withinLimits, lowered: lowest(SIZE_KINDS), rose: sizeRose,
};

const isAllowance = (value: unknown): value is AllowanceGrant =>
  isRecord(value) && typeof value.path === 'string' && typeof value.step === 'string'
  && typeof value.reason === 'string' && typeof value.date === 'string';

/**
 * A size baseline from its decoded JSON; `file` names where it was read, for the refusal. It keeps only what the gate
 * holds, so a baseline written while entries and allowances still recorded import lines reads without them.
 */
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
    files: Object.fromEntries(Object.entries(parseFiles(value.files, SIZE_RULE.isNumbers, invalid))
      .map(([file, numbers]) => [file, numbersOf(numbers)])),
    allowances: allowances.map(grantOf),
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

/** The lower numbers, with files that now pass or are gone dropped, and their allowances with them. */
export function ratcheted(
  baseline: SizeBaseline,
  measuredFiles: ReadonlyMap<string, FileMeasurement>,
): SizeBaseline {
  const files = ratchetedFiles(baseline.files, measuredFiles, SIZE_RULE);
  const allowances = baseline.allowances.filter(allowance => Object.hasOwn(files, allowance.path));
  return { ...baseline, files, allowances };
}

/**
 * Raises one baselined file to its current numbers, for import lines a split added and nothing else, measured against
 * `committed`, the file as the base branch holds it, and records the step and the reason. Throws, writing nothing, for
 * any other growth.
 */
export function allowed(
  baseline: SizeBaseline,
  measuredFiles: ReadonlyMap<string, FileMeasurement>,
  grant: AllowanceGrant,
  committed: FileMeasurement | undefined,
): SizeBaseline {
  const refuse = (reason: string): never => {
    throw new Error(`size-gate: no allowance for ${grant.path}: ${reason}.`);
  };
  const base = baseline.files[grant.path], measured = measuredFiles.get(grant.path);
  if (!grant.step || !grant.reason) return refuse('an allowance names the step that caused it and why');
  if (!base) return refuse('only a baselined file takes an allowance');
  if (!measured) return refuse('the file is gone');
  if (!committed) return refuse('the base branch does not hold the file, so nothing measures what the split added');
  const refusal = allowanceRefusal({ numbers: base, measured: committed }, { numbers: numbersOf(measured), measured });
  if (refusal) return refuse(refusal);
  const files = { ...baseline.files, [grant.path]: numbersOf(measured) };
  return { ...baseline, files, allowances: [...baseline.allowances, grantOf(grant)] };
}
