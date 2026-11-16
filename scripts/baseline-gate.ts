// The baseline gate: each baseline this repository holds only falls. It refuses a file whose numbers rose above the
// base branch's baseline, or that the base branch's baseline does not name, unless the size baseline records an
// allowance for that file which the base branch lacks, raising it from the base branch's numbers by what the
// allowance rule in scripts/sizeGate/compare.ts grants. A baseline the base branch does not hold yet is new, and the
// gate says so.
//   node scripts/baseline-gate.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { risenFiles, type BaselinedFiles, type FileNumbers } from './baseline/baselinedFiles.ts';
import { gitOutput, gitSucceeds } from './repositoryFiles.ts';
import { SUITE_BASELINE } from './size-gate.ts';
import { SIZE_RULE, parseBaseline } from './sizeGate/baselineFile.ts';
import { allowanceRefusal } from './sizeGate/compare.ts';
import type { AllowanceSpan, BaselineNumbers, SizeBaseline } from './sizeGate/limits.ts';
import {
  CAST_BASELINE, CAST_RULE, parseCastBaseline, type CastBaseline, type CastNumbers,
} from './typeGate/castBaseline.ts';

/** The branch every pull request here merges into, whose baselines a branch may only lower, and where it is fetched. */
const BASE = { remote: 'origin', branch: 'main' } as const;
const BASE_BRANCH = `${BASE.remote}/${BASE.branch}`;

/**
 * How this gate reads one baseline: its path, its decoding, when a file rose, and why no record accounts for a file's
 * rise, undefined when one does.
 */
interface BaselineReading<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }> {
  readonly file: string;
  readonly parse: (value: unknown, file: string) => Baseline;
  readonly rose: (base: Numbers, head: Numbers) => boolean;
  readonly unaccounted: (base: Baseline, head: Baseline, file: string) => string | undefined;
}

const sameSpan = (span: AllowanceSpan, numbers: AllowanceSpan): boolean =>
  span.lines === numbers.lines && span.importLines === numbers.importLines;

/** Why no allowance the base branch lacks raises a size file from the base branch's numbers to its own, if so. */
function allowanceUnaccounted(base: SizeBaseline, head: SizeBaseline, file: string): string | undefined {
  if (!Object.hasOwn(base.files, file)) return `only a file ${BASE_BRANCH} baselines takes an allowance`;
  const was = base.files[file];
  const before = new Set(base.allowances.map(allowance => JSON.stringify(allowance)));
  const raised = head.allowances.some(allowance => allowance.path === file
    && !before.has(JSON.stringify(allowance)) && sameSpan(allowance.from, was));
  return raised ? allowanceRefusal(was, head.files[file]) : `no new allowance raises it from ${BASE_BRANCH}'s numbers`;
}

const SIZE: BaselineReading<BaselineNumbers, SizeBaseline> = {
  file: SUITE_BASELINE, parse: parseBaseline, rose: SIZE_RULE.rose, unaccounted: allowanceUnaccounted,
};
const CASTS: BaselineReading<CastNumbers, CastBaseline> = {
  file: CAST_BASELINE, parse: parseCastBaseline, rose: CAST_RULE.rose, unaccounted: () => 'no allowance covers a cast',
};

/** Each refusal for one baseline against the base branch's, or the notice that the base branch holds none. */
function risen<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }>(
  root: string,
  { file, parse, rose, unaccounted }: BaselineReading<Numbers, Baseline>,
): { refusals: string[]; notices: string[] } {
  const onBase = gitOutput(root, ['ls-tree', '--name-only', BASE_BRANCH, '--', file]).trim();
  if (!onBase) return { refusals: [], notices: [`${file} is new: ${BASE_BRANCH} holds none to hold it to`] };
  const baseName = `${BASE_BRANCH}:${file}`;
  const base = parse(JSON.parse(gitOutput(root, ['show', baseName])), baseName);
  const head = parse(JSON.parse(readFileSync(path.join(root, file), 'utf8')), file);
  const refusals = risenFiles(base.files, head.files, rose).flatMap(entry => {
    const why = unaccounted(base, head, entry);
    if (!why) return [];
    const was = Object.hasOwn(base.files, entry) ? JSON.stringify(base.files[entry]) : 'nothing';
    const now = JSON.stringify(head.files[entry]);
    return [`${file}: ${entry} is ${now}, above ${was} on ${BASE_BRANCH}; a baseline only falls, and ${why}`];
  });
  return { refusals, notices: [] };
}

/** Runs the gate in `root` and returns its exit code; refuses, saying how to fetch it, when `root` lacks the base. */
function gateBaselines(root: string): number {
  if (!gitSucceeds(root, ['rev-parse', '--verify', '--quiet', `${BASE_BRANCH}^{commit}`])) {
    const fetch = `git fetch ${BASE.remote} ${BASE.branch}`;
    const expected = `${BASE_BRANCH}, the branch each baseline may only fall from`;
    console.error(`baseline gate: ${root} has no ${expected}; fetch it with ${fetch}.`);
    return 1;
  }
  const results = [risen(root, SIZE), risen(root, CASTS)];
  const refusals = results.flatMap(result => result.refusals);
  for (const notice of results.flatMap(result => result.notices)) console.log(`baseline gate: ${notice}.`);
  for (const refusal of refusals) console.error(`baseline gate: ${refusal}.`);
  console.log(`baseline gate: ${refusals.length} risen against ${BASE_BRANCH}.`);
  return refusals.length ? 1 : 0;
}

process.exitCode = gateBaselines(process.cwd());
