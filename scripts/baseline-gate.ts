// The baseline gate: each baseline this repository holds only falls. It refuses a file whose numbers rose above the
// base branch's baseline, or that the base branch's baseline does not name, unless an allowance the base branch lacks
// covers the rise (scripts/baseline/allowance.ts): for size, only import lines a split added as measured in both files
// (scripts/sizeGate/compare.ts); for per-tick allocation, an allowance citing the owner's decision. An allocation
// entry the base branch does not name enters at the measured maximum it records, since a sampled ceiling has no limit
// to rise from, and only falls from then (`ALLOCATIONS`); a size or cast entry does not.
// A baseline the base branch does not hold yet is new, and the gate says so.
//   node scripts/baseline-gate.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { allowanceUnaccounted, type AllowanceCheck } from './baseline/allowance.ts';
import { ALLOCATION_BASELINE, parseBaseAllocationBaseline } from './baseline/allocationBaseline.ts';
import { BASE_BRANCH, baseBranchAbsence } from './baseline/baseBranch.ts';
import {
  risenFiles, type BaselinedFiles, type BaselineModule, type FileNumbers, type NumbersOf,
} from './baseline/baselinedFiles.ts';
import { gitOutput } from './repositoryFiles.ts';
import { SUITE_BASELINE } from './size-gate.ts';
import { SIZE_RULE, parseBaseline } from './sizeGate/baselineFile.ts';
import { allowanceRefusal } from './sizeGate/compare.ts';
import type { AllowanceGrant, BaselineNumbers, SizeBaseline } from './sizeGate/limits.ts';
import { measureCommitted, measureWorking } from './sizeGate/measure.ts';
import { parseWithoutRetiredFields } from './sizeGate/retiredFields.ts';
import { CAST_BASELINE } from './typeGate/castBaseline.ts';

/**
 * How this gate reads one baseline: its path, its decoding in the working tree and on the base branch, when a file
 * rose, why an unbaselined entry is refused (undefined when it enters at its recorded numbers), and why a risen
 * baselined file is refused (undefined when accounted for). `parseBase` bridges formats the base branch still holds
 * (scripts/sizeGate/retiredFields.ts and scripts/baseline/allocationBaseline.ts).
 */
interface BaselineReading<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }> {
  readonly file: string;
  readonly parse: (value: unknown, file: string) => Baseline;
  readonly parseBase: (value: unknown, file: string) => Baseline;
  readonly rose: (base: Numbers, head: Numbers) => boolean;
  readonly unbaselined: string | undefined;
  readonly unaccounted: (root: string, base: Baseline, head: Baseline, file: string, from: Numbers) =>
    string | undefined;
}

const moduleReading = <
  Kind extends string,
  Baseline extends { readonly files: BaselinedFiles<NumbersOf<Kind>> },
>(
  baseline: BaselineModule<Kind, Baseline>,
  parseBase: BaselineReading<NumbersOf<Kind>, Baseline>['parseBase'],
  unbaselined: string | undefined,
  unaccounted: BaselineReading<NumbersOf<Kind>, Baseline>['unaccounted'],
): BaselineReading<NumbersOf<Kind>, Baseline> => ({
  file: baseline.file, parse: baseline.parse, parseBase, rose: baseline.rose, unbaselined, unaccounted,
});

function sizeAllowanceRefusal(
  { root, file, from, to }: AllowanceCheck<BaselineNumbers, AllowanceGrant>,
): string | undefined {
  const committed = measureCommitted(root, BASE_BRANCH, file);
  if (!committed) return `${BASE_BRANCH} does not hold the file, so nothing measures what the split added`;
  const measured = measureWorking(root, file);
  if (!measured) return 'the file is gone';
  return allowanceRefusal({ numbers: from, measured: committed }, { numbers: to, measured });
}

const SIZE: BaselineReading<BaselineNumbers, SizeBaseline> = {
  file: SUITE_BASELINE, parse: parseBaseline, parseBase: parseWithoutRetiredFields, rose: SIZE_RULE.rose,
  unbaselined: `only a file ${BASE_BRANCH} baselines takes an allowance`,
  unaccounted: allowanceUnaccounted(sizeAllowanceRefusal),
};
const NO_CAST_ALLOWANCE = 'no allowance covers a cast';
const CASTS = moduleReading(CAST_BASELINE, CAST_BASELINE.parse, NO_CAST_ALLOWANCE, () => NO_CAST_ALLOWANCE);
/**
 * A sampled allocation ceiling has no limit to rise from until the owner sets its budget, so an entry the base branch
 * does not name enters at the maximum it records, and only falls from then unless an allowance citing the owner's
 * decision admits a rise.
 */
const ALLOCATIONS = moduleReading(
  ALLOCATION_BASELINE,
  parseBaseAllocationBaseline,
  undefined,
  allowanceUnaccounted(() => undefined),
);

/** Each refusal for one baseline against the base branch's, or the notice that the base branch holds none. */
function risen<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }>(
  root: string,
  { file, parse, parseBase, rose, unbaselined, unaccounted }: BaselineReading<Numbers, Baseline>,
): { refusals: string[]; notices: string[] } {
  const onBase = gitOutput(root, ['ls-tree', '--name-only', BASE_BRANCH, '--', file]).trim();
  if (!onBase) return { refusals: [], notices: [`${file} is new: ${BASE_BRANCH} holds none to hold it to`] };
  const baseName = `${BASE_BRANCH}:${file}`;
  const base = parseBase(JSON.parse(gitOutput(root, ['show', baseName])), baseName);
  const head = parse(JSON.parse(readFileSync(path.join(root, file), 'utf8')), file);
  const refusals = risenFiles(base.files, head.files, rose).flatMap(({ file: entry, base: was }) => {
    const why = was === undefined ? unbaselined : unaccounted(root, base, head, entry, was);
    if (!why) return [];
    const before = was ? JSON.stringify(was) : 'nothing';
    const now = JSON.stringify(head.files[entry]);
    return [`${file}: ${entry} is ${now}, above ${before} on ${BASE_BRANCH}; a baseline only falls, and ${why}`];
  });
  return { refusals, notices: [] };
}

/** Runs the gate in `root` and returns its exit code; refuses, saying how to fetch it, when `root` lacks the base. */
function gateBaselines(root: string): number {
  const absence = baseBranchAbsence(root);
  if (absence) {
    console.error(`baseline gate: ${absence}.`);
    return 1;
  }
  const results = [risen(root, SIZE), risen(root, CASTS), risen(root, ALLOCATIONS)];
  const refusals = results.flatMap(result => result.refusals);
  for (const notice of results.flatMap(result => result.notices)) console.log(`baseline gate: ${notice}.`);
  for (const refusal of refusals) console.error(`baseline gate: ${refusal}.`);
  console.log(`baseline gate: ${refusals.length} risen against ${BASE_BRANCH}.`);
  return refusals.length ? 1 : 0;
}

process.exitCode = gateBaselines(process.cwd());
