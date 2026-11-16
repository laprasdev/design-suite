import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUITE_BASELINE } from '../scripts/size-gate.ts';
import { readBaseline, sizeBaselineText } from '../scripts/sizeGate/baselineFile.ts';
import { compare } from '../scripts/sizeGate/compare.ts';
import {
  LINE_CHARACTER_LIMIT, type AllowanceRecord, type BaselineNumbers, type SizeBaseline,
} from '../scripts/sizeGate/limits.ts';
import { CAST_BASELINE, castBaselineText, type CastNumbers } from '../scripts/typeGate/castBaseline.ts';
import { GATE, runGate, type GateTree } from './gateFixture.ts';

const casts = (files: Record<string, CastNumbers>) => ({ [CAST_BASELINE]: castBaselineText({ files }) });
const ONE_CAST = { 'src/a.ts': { casts: 1, nonNullAssertions: 0 } };
const TWO_CASTS = { 'src/a.ts': { casts: 2, nonNullAssertions: 0 } };
const baselines = (tree: GateTree) => runGate(GATE.baselines, tree, process.env);

const SUITE_SIZE = readBaseline(fileURLToPath(new URL(`../${SUITE_BASELINE}`, import.meta.url)));
/** The size baseline with `files` and `allowances` in place of this repository's. */
const sizeBaseline = (change: Pick<SizeBaseline, 'files' | 'allowances'>) =>
  ({ [SUITE_BASELINE]: sizeBaselineText({ ...SUITE_SIZE, ...change }) });
const SIZE_BASE = { 'src/a.ts': { lines: 300, longLines: 1, importLines: 4 } };
const SIZE_HEAD = { 'src/a.ts': { lines: 303, longLines: 1, importLines: 7 } };
const ALLOWANCE = {
  path: 'src/a.ts', step: '3', reason: 'a split', date: '2026-11-15',
  from: { lines: 300, importLines: 4 }, to: { lines: 303, importLines: 7 },
};
const SIZE_ORIGIN = { ...casts({}), ...sizeBaseline({ files: SIZE_BASE, allowances: [] }) };

/** A head that raises src/a.ts to `numbers` through `allowance`, as the baseline gate and size-gate --check read it. */
function raisedThrough(numbers: BaselineNumbers, allowance: AllowanceRecord) {
  const change = { files: { 'src/a.ts': numbers }, allowances: [allowance] };
  const characters = LINE_CHARACTER_LIMIT + 1;
  const long = Array.from({ length: numbers.longLines }, (_, index) => ({ line: index + 1, characters }));
  const measured = new Map([['src/a.ts', { ...numbers, long }]]);
  return {
    baselineGate: baselines({ base: SIZE_ORIGIN, head: { ...casts({}), ...sizeBaseline(change) } }),
    sizeCheck: compare(measured, { ...SUITE_SIZE, ...change }).problems,
  };
}

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

  it('refuses a size baseline that rose, unless an allowance raised it or its imports rose as lines fell', () => {
    const base = { ...casts({}), ...sizeBaseline({ files: SIZE_BASE, allowances: [] }) };
    const raised = baselines({ base, head: { ...casts({}), ...sizeBaseline({ files: SIZE_HEAD, allowances: [] }) } });
    assert.equal(raised.status, 1, raised.output);
    assert.match(raised.output, /size-baseline\.json: src\/a\.ts is \{"lines":303/);
    const allowed = sizeBaseline({ files: SIZE_HEAD, allowances: [ALLOWANCE] });
    assert.equal(baselines({ base, head: { ...casts({}), ...allowed } }).status, 0);
    const fewerLines = { 'src/a.ts': { lines: 290, longLines: 1, importLines: 6 } };
    const shorter = sizeBaseline({ files: fewerLines, allowances: [] });
    assert.equal(baselines({ base, head: { ...casts({}), ...shorter } }).status, 0, 'imports rise as lines fall');
    const taller = { 'src/a.ts': { ...SIZE_HEAD['src/a.ts'], lines: 304 } };
    const beyond = sizeBaseline({ files: taller, allowances: [ALLOWANCE] });
    assert.equal(baselines({ base, head: { ...casts({}), ...beyond } }).status, 1);
  });
});

describe('an allowance, held to the one allowance rule by the baseline gate and size-gate --check alike', () => {
  it('refuses lines that are not imports under a hand-written allowance', () => {
    const grown = { lines: 464, longLines: 1, importLines: 4 };
    const { baselineGate, sizeCheck } = raisedThrough(grown, { ...ALLOWANCE, to: { lines: 464, importLines: 4 } });
    assert.equal(baselineGate.status, 1, baselineGate.output);
    assert.match(baselineGate.output, /src\/a\.ts is .*; a baseline only falls, and it grew by 164 lines that aren't/);
    const refusal = 'src/a.ts: the allowance for step 3 does not hold: it grew by 164 lines that aren\'t imports';
    assert.deepEqual(sizeCheck, [refusal]);
  });

  it('passes the import lines a split added', () => {
    const { baselineGate, sizeCheck } = raisedThrough(SIZE_HEAD['src/a.ts'], ALLOWANCE);
    assert.equal(baselineGate.status, 0, baselineGate.output);
    assert.deepEqual(sizeCheck, []);
  });

  it('refuses an allowance whose from is not origin/main\'s numbers', () => {
    const { baselineGate, sizeCheck } = raisedThrough(SIZE_HEAD['src/a.ts'], {
      ...ALLOWANCE, from: { lines: 301, importLines: 4 },
    });
    assert.equal(baselineGate.status, 1, baselineGate.output);
    assert.match(baselineGate.output, /no new allowance raises it from origin\/main's numbers/);
    assert.deepEqual(sizeCheck, [], 'only origin/main shows the from is not its own');
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
