// The baseline gate: each baseline this repository holds only falls. It refuses a file whose numbers rose above the
// base branch's baseline, or that the base branch's baseline does not name, unless the size baseline records an
// allowance for that file which the base branch lacks. A baseline the base branch does not hold yet is new, and the
// gate says so.
//   node scripts/baseline-gate.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { risenFiles, type BaselinedFiles, type FileNumbers } from './baseline/baselinedFiles.ts';
import { gitOutput } from './repositoryFiles.ts';
import { SUITE_BASELINE } from './size-gate.ts';
import { SIZE_RULE, parseBaseline } from './sizeGate/baselineFile.ts';
import type { BaselineNumbers, SizeBaseline } from './sizeGate/limits.ts';
import {
  CAST_BASELINE, CAST_RULE, parseCastBaseline, type CastBaseline, type CastNumbers,
} from './typeGate/castBaseline.ts';

/** The branch every pull request here merges into, whose baselines a branch may only lower. */
const BASE_BRANCH = 'origin/main';

/** How this gate reads one baseline: its path, its decoding, when a file rose, and which rise a record explains. */
interface BaselineReading<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }> {
  readonly file: string;
  readonly parse: (value: unknown, file: string) => Baseline;
  readonly rose: (base: Numbers, head: Numbers) => boolean;
  readonly accounts: (base: Baseline, head: Baseline, file: string) => boolean;
}

/** A size file rose by an allowance the base branch lacks, to the very numbers the allowance raised it to. */
function allowanceAccounts(base: SizeBaseline, head: SizeBaseline, file: string): boolean {
  const before = new Set(base.allowances.map(allowance => JSON.stringify(allowance)));
  const now = head.files[file];
  return Object.hasOwn(base.files, file) && now.longLines <= base.files[file].longLines
    && head.allowances.some(allowance => allowance.path === file && !before.has(JSON.stringify(allowance))
      && allowance.to.lines === now.lines && allowance.to.importLines === now.importLines);
}

const SIZE: BaselineReading<BaselineNumbers, SizeBaseline> = {
  file: SUITE_BASELINE, parse: parseBaseline, rose: SIZE_RULE.rose, accounts: allowanceAccounts,
};
const CASTS: BaselineReading<CastNumbers, CastBaseline> = {
  file: CAST_BASELINE, parse: parseCastBaseline, rose: CAST_RULE.rose, accounts: () => false,
};

/** Each refusal for one baseline against the base branch's, or the notice that the base branch holds none. */
function risen<Numbers extends FileNumbers, Baseline extends { readonly files: BaselinedFiles<Numbers> }>(
  root: string,
  { file, parse, rose, accounts }: BaselineReading<Numbers, Baseline>,
): { refusals: string[]; notices: string[] } {
  const onBase = gitOutput(root, ['ls-tree', '--name-only', BASE_BRANCH, '--', file]).trim();
  if (!onBase) return { refusals: [], notices: [`${file} is new: ${BASE_BRANCH} holds none to hold it to`] };
  const baseName = `${BASE_BRANCH}:${file}`;
  const base = parse(JSON.parse(gitOutput(root, ['show', baseName])), baseName);
  const head = parse(JSON.parse(readFileSync(path.join(root, file), 'utf8')), file);
  const refusals = risenFiles(base.files, head.files, rose).filter(entry => !accounts(base, head, entry)).map(entry => {
    const was = Object.hasOwn(base.files, entry) ? JSON.stringify(base.files[entry]) : 'nothing';
    const now = JSON.stringify(head.files[entry]);
    return `${file}: ${entry} is ${now}, above ${was} on ${BASE_BRANCH}; a baseline only falls`;
  });
  return { refusals, notices: [] };
}

const root = process.cwd();
const results = [risen(root, SIZE), risen(root, CASTS)];
const refusals = results.flatMap(result => result.refusals);
for (const notice of results.flatMap(result => result.notices)) console.log(`baseline gate: ${notice}.`);
for (const refusal of refusals) console.error(`baseline gate: ${refusal}.`);
console.log(`baseline gate: ${refusals.length} risen against ${BASE_BRANCH}.`);
process.exitCode = refusals.length ? 1 : 0;
