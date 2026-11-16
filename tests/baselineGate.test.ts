import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUITE_BASELINE } from '../scripts/size-gate.ts';
import { SIZE_RULE, readBaseline, sizeBaselineText } from '../scripts/sizeGate/baselineFile.ts';
import {
  FILE_LINE_LIMIT, LINE_CHARACTER_LIMIT, type AllowanceGrant, type SizeBaseline,
} from '../scripts/sizeGate/limits.ts';
import { CAST_BASELINE, castBaselineText, type CastNumbers } from '../scripts/typeGate/castBaseline.ts';
import { GATE, runGate, type GateTree } from './gateFixture.ts';

const casts = (files: Record<string, CastNumbers>) => ({ [CAST_BASELINE]: castBaselineText({ files }) });
const ONE_CAST = { 'src/a.ts': { casts: 1, nonNullAssertions: 0 } };
const TWO_CASTS = { 'src/a.ts': { casts: 2, nonNullAssertions: 0 } };
const baselines = (tree: GateTree) => runGate(GATE.baselines, tree, process.env);

const SUITE_SIZE = readBaseline(fileURLToPath(new URL(`../${SUITE_BASELINE}`, import.meta.url)));
/** The size baseline with `files` and `allowances` in place of this repository's, and no casts. */
const sizeBaseline = (change: Pick<SizeBaseline, 'files' | 'allowances'>) =>
  ({ ...casts({}), [SUITE_BASELINE]: sizeBaselineText({ ...SUITE_SIZE, ...change }) });
/** src/a.ts at `lines` lines, opening with `imports` import lines, and one long line. */
const source = (lines: number, imports: number) => ({
  'src/a.ts': Array.from({ length: lines }, (_, index) => index < imports ? "import { a } from './a';"
    : index === imports ? 'x'.repeat(LINE_CHARACTER_LIMIT + 1) : 'x').join('\n') + '\n',
});
const entry = (lines: number) => ({ 'src/a.ts': { lines, longLines: 1 } });
const ALLOWANCE: AllowanceGrant = { path: 'src/a.ts', step: '3', reason: 'a split', date: '2026-11-15' };
/** origin/main: src/a.ts baselined at 300 lines, 4 of them imports. */
const SIZE_ORIGIN = { ...sizeBaseline({ files: entry(300), allowances: [] }), ...source(300, 4) };

/** The baseline gate on a head that baselines src/a.ts at `lines`, holding `file`, through `allowances`. */
const raised = (lines: number, file: Record<string, string>, allowances: readonly AllowanceGrant[] = [ALLOWANCE]) =>
  baselines({ base: SIZE_ORIGIN, head: { ...sizeBaseline({ files: entry(lines), allowances }), ...file } });

describe('the baseline gate', () => {
  it('refuses a cast baseline that rose above origin/main, naming the file', () => {
    const run = baselines({ base: casts(ONE_CAST), head: casts(TWO_CASTS) });
    assert.equal(run.status, 1, run.output);
    const named = /cast-baseline\.json: src\/a\.ts is \{"casts":2,"nonNullAssertions":0\}, above \{"casts":1,/;
    assert.match(run.output, named);
    const added = baselines({ base: casts({}), head: casts(ONE_CAST) });
    assert.equal(added.status, 1, added.output);
    assert.match(added.output, /src\/a\.ts is \{"casts":1,"nonNullAssertions":0\}, above nothing on origin\/main/);
  });

  it('passes a baseline that fell, and one origin/main does not hold yet', () => {
    assert.equal(baselines({ base: casts(TWO_CASTS), head: casts(ONE_CAST) }).status, 0);
    const fresh = baselines({ base: {}, head: casts(ONE_CAST) });
    assert.equal(fresh.status, 0, fresh.output);
    assert.match(fresh.output, /cast-baseline\.json is new: origin\/main holds none/);
  });

  it('refuses a size baseline that rose, unless an allowance raised it or it fell', () => {
    const unallowed = raised(303, source(303, 7), []);
    assert.equal(unallowed.status, 1, unallowed.output);
    assert.match(unallowed.output, /size-baseline\.json: src\/a\.ts is \{"lines":303/);
    assert.equal(raised(303, source(303, 7)).status, 0);
    assert.equal(raised(290, source(290, 6), []).status, 0, 'it fell');
    assert.equal(raised(304, source(304, 7)).status, 1, 'one line past what the split added');
  });

  it('reads origin/main\'s baseline without the retired fields, and refuses one in the working tree\'s', () => {
    const files = { 'src/a.ts': { lines: 300, longLines: 1, importLines: 4 } };
    const base = { ...casts({}), [SUITE_BASELINE]: JSON.stringify({ ...SUITE_SIZE, files }), ...source(300, 4) };
    const current = sizeBaseline({ files: entry(290), allowances: [] });
    const fell = baselines({ base, head: { ...current, ...source(290, 4) } });
    assert.equal(fell.status, 0, fell.output);
    const retired = baselines({ base, head: source(290, 4) });
    assert.equal(retired.status, 1, retired.output);
    assert.match(retired.output, /size-baseline\.json files\["src\/a\.ts"\] holds importLines; it takes lines/);
  });

  it('reads a size rise by the size gate\'s own cap, so a baseline may record what its file measures', () => {
    const longOnly = { lines: 150, longLines: 1 }, over = { lines: 300, longLines: 1 };
    assert.equal(SIZE_RULE.rose(longOnly, { lines: FILE_LINE_LIMIT, longLines: 1 }), false);
    assert.equal(SIZE_RULE.rose(longOnly, { lines: FILE_LINE_LIMIT + 1, longLines: 1 }), true);
    assert.equal(SIZE_RULE.rose(over, { lines: 301, longLines: 1 }), true);
    assert.equal(SIZE_RULE.rose(over, { lines: 300, longLines: 2 }), true);
  });
});

describe('an allowance, held to the one allowance rule on import lines measured in both files', () => {
  it('refuses lines that are not imports under a hand-written allowance', () => {
    const run = raised(464, source(464, 4));
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /src\/a\.ts is .*; a baseline only falls, and it grew by 164 lines that aren't imports/);
  });

  it('passes the import lines a split added', () => {
    const run = raised(303, source(303, 7));
    assert.equal(run.status, 0, run.output);
  });

  it('refuses a rise that the import lines measured in its file do not cover', () => {
    const run = raised(303, source(303, 4));
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /and it grew by 3 lines that aren't imports/);
  });

  it('refuses an allowance origin/main already holds', () => {
    const allowed = { ...sizeBaseline({ files: entry(300), allowances: [ALLOWANCE] }), ...source(300, 4) };
    const head = { ...sizeBaseline({ files: entry(303), allowances: [ALLOWANCE] }), ...source(303, 7) };
    const run = baselines({ base: allowed, head });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /no allowance origin\/main lacks raises it/);
  });
});

describe('the baseline gate without origin/main', () => {
  it('refuses by name, saying how to fetch it', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'baseline-gate-'));
    try {
      assert.equal(spawnSync('git', ['init', '--quiet', root]).status, 0);
      const [program, ...args] = GATE.baselines;
      const run = spawnSync(program, args, { cwd: root, encoding: 'utf8' });
      assert.equal(run.status, 1, run.stderr);
      const refusal = /has no origin\/main, the branch each baseline may only fall from; fetch it with git fetch/;
      assert.match(run.stderr, refusal);
      assert.match(run.stderr, /git fetch origin main\./);
      assert.doesNotMatch(run.stderr, /\n\s+at /, 'a refusal, not a stack trace');
    } finally {
      rmSync(root, { recursive: true });
    }
  });
});
