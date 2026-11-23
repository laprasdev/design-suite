// The size gate's baseline: what it covers, the numbers of each file over a limit, and the allowances granted.
// The numbers only fall (scripts/baseline/baselinedFiles.ts), except through an allowance that a step records for
// import lines its split added. It records no import lines: the allowance rule measures them in both files.
import { readFileSync, writeFileSync } from 'node:fs';
import { refusalBy } from '../build/fieldChecks.ts';
import { allowanceListJson, keptAllowances } from '../baseline/allowance.ts';
import {
  baselineRefusal, baselineText, filesJson, lowest, ratchetedFiles, type BaselineRule,
} from '../baseline/baselinedFiles.ts';
import { allowanceRefusal, sizeRose, withinLimits } from './compare.ts';
import {
  SIZE_KINDS, holdsSizeAllowance, holdsSizeBaseline, type AllowanceGrant, type BaselineNumbers, type FileMeasurement,
  type SizeBaseline, type SizeScope,
} from './limits.ts';

const numbersOf = ({ lines, longLines }: BaselineNumbers): BaselineNumbers => ({ lines, longLines });

export const SIZE_RULE: BaselineRule<BaselineNumbers, FileMeasurement> = {
  withinLimits, lowered: lowest(SIZE_KINDS), rose: sizeRose,
};

/** A size baseline from its decoded JSON; `file` names where it was read, for the refusal. */
export function parseBaseline(value: unknown, file: string): SizeBaseline {
  holdsSizeBaseline(value, '', baselineRefusal(`size-gate: ${file}`));
  return value;
}

export function readBaseline(file: string): SizeBaseline {
  return parseBaseline(JSON.parse(readFileSync(file, 'utf8')), file);
}

export const sizeBaselineText = (baseline: SizeBaseline): string => baselineText({
  scope: JSON.stringify(baseline.scope),
  files: filesJson(baseline.files),
  allowances: allowanceListJson(baseline.allowances),
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
  return { ...baseline, files, allowances: keptAllowances(files, baseline.allowances) };
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
  holdsSizeAllowance(grant, '', refusalBy(refuse, 'the allowance'));
  const base = baseline.files[grant.path], measured = measuredFiles.get(grant.path);
  if (!base) return refuse('only a baselined file takes an allowance');
  if (!measured) return refuse('the file is gone');
  if (!committed) return refuse('the base branch does not hold the file, so nothing measures what the split added');
  const next = numbersOf(measured);
  const refusal = allowanceRefusal({ numbers: base, measured: committed }, { numbers: next, measured });
  if (refusal) return refuse(refusal);
  return { ...baseline, files: { ...baseline.files, [grant.path]: next }, allowances: [...baseline.allowances, grant] };
}
