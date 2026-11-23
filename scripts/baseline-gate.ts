// The baseline gate: each baseline this repository holds only falls. It refuses a file whose numbers rose above the
// base branch's baseline, or that the base branch's baseline does not name, unless the size baseline records an
// allowance for that file which the base branch lacks, raising it from the base branch's numbers by what the
// allowance rule in scripts/sizeGate/compare.ts grants, with the import lines measured in the file as the base branch
// and the working tree hold it. An allocation entry the base branch does not name enters at the measured maximum it
// records, since a sampled ceiling has no limit to rise from, and only falls from then (`ALLOCATIONS`); a size or cast
// entry does not.
// A baseline the base branch does not hold yet is new, and the gate says so.
//   node scripts/baseline-gate.ts
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BASE_BRANCH, baseBranchAbsence } from './baseline/baseBranch.ts';
import {
  risenFiles, type BaselinedFiles, type FileNumbers, type FilesBaseline, type FilesBaselineModule, type NumbersOf,
  type RisenFile,
} from './baseline/baselinedFiles.ts';
import { gitOutput } from './repositoryFiles.ts';
import { SUITE_BASELINE } from './size-gate.ts';
import { SIZE_RULE, parseBaseline } from './sizeGate/baselineFile.ts';
import { allowanceRefusal } from './sizeGate/compare.ts';
import type { BaselineNumbers, SizeBaseline } from './sizeGate/limits.ts';
import { measureCommitted, measureText } from './sizeGate/measure.ts';
import { parseWithoutRetiredFields } from './sizeGate/retiredFields.ts';
import { ALLOCATION_BASELINE } from './baseline/allocationBaseline.ts';
import { CAST_BASELINE } from './typeGate/castBaseline.ts';

/**
 * How this gate reads one baseline: its path, its decoding in the working tree and on the base branch, when a file
 * rose, and why no record accounts for a risen file, undefined when one does. `parseBase` is the bridge in
 * scripts/sizeGate/retiredFields.ts and goes with it.
 */
interface BaselineReading<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }> {
  readonly file: string;
  readonly parse: (value: unknown, file: string) => Baseline;
  readonly parseBase: (value: unknown, file: string) => Baseline;
  readonly rose: (base: Numbers, head: Numbers) => boolean;
  readonly unaccounted: (root: string, base: Baseline, head: Baseline, risen: RisenFile<Numbers>) => string | undefined;
}

/** Why no allowance the base branch lacks raises a size file from the base branch's version to its own, if so. */
function allowanceUnaccounted(
  root: string, base: SizeBaseline, head: SizeBaseline, { file, base: was }: RisenFile<BaselineNumbers>,
): string | undefined {
  if (!was) return `only a file ${BASE_BRANCH} baselines takes an allowance`;
  const before = new Set(base.allowances.map(allowance => JSON.stringify(allowance)));
  const granted = head.allowances.some(allowance => allowance.path === file && !before.has(JSON.stringify(allowance)));
  if (!granted) return `no allowance ${BASE_BRANCH} lacks raises it`;
  const committed = measureCommitted(root, BASE_BRANCH, file);
  if (!committed) return `${BASE_BRANCH} does not hold the file, so nothing measures what the split added`;
  const headFile = path.join(root, file);
  if (!existsSync(headFile)) return 'the file is gone';
  const measured = measureText(readFileSync(headFile, 'utf8'));
  return allowanceRefusal({ numbers: was, measured: committed }, { numbers: head.files[file], measured });
}

const filesReading = <Kind extends string>(
  baseline: FilesBaselineModule<Kind>,
  unaccounted: BaselineReading<NumbersOf<Kind>, FilesBaseline<Kind>>['unaccounted'],
): BaselineReading<NumbersOf<Kind>, FilesBaseline<Kind>> => ({
  file: baseline.file, parse: baseline.parse, parseBase: baseline.parse, rose: baseline.rose, unaccounted,
});

const SIZE: BaselineReading<BaselineNumbers, SizeBaseline> = {
  file: SUITE_BASELINE, parse: parseBaseline, parseBase: parseWithoutRetiredFields, rose: SIZE_RULE.rose,
  unaccounted: allowanceUnaccounted,
};
const CASTS = filesReading(CAST_BASELINE, () => 'no allowance covers a cast');
/**
 * A sampled allocation ceiling has no limit to rise from until the owner sets its budget, so an entry the base branch
 * does not name enters at the maximum it records, and only falls from then.
 */
const ALLOCATIONS = filesReading(ALLOCATION_BASELINE,
  (_root, _base, _head, { base: was }) => (was ? 'no allowance covers per-tick allocation' : undefined));

/** Each refusal for one baseline against the base branch's, or the notice that the base branch holds none. */
function risen<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }>(
  root: string,
  { file, parse, parseBase, rose, unaccounted }: BaselineReading<Numbers, Baseline>,
): { refusals: string[]; notices: string[] } {
  const onBase = gitOutput(root, ['ls-tree', '--name-only', BASE_BRANCH, '--', file]).trim();
  if (!onBase) return { refusals: [], notices: [`${file} is new: ${BASE_BRANCH} holds none to hold it to`] };
  const baseName = `${BASE_BRANCH}:${file}`;
  const base = parseBase(JSON.parse(gitOutput(root, ['show', baseName])), baseName);
  const head = parse(JSON.parse(readFileSync(path.join(root, file), 'utf8')), file);
  const refusals = risenFiles(base.files, head.files, rose).flatMap(entry => {
    const why = unaccounted(root, base, head, entry);
    if (!why) return [];
    const was = entry.base ? JSON.stringify(entry.base) : 'nothing';
    const now = JSON.stringify(head.files[entry.file]);
    return [`${file}: ${entry.file} is ${now}, above ${was} on ${BASE_BRANCH}; a baseline only falls, and ${why}`];
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
