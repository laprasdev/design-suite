import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUITE_BASELINE } from '../scripts/size-gate.ts';
import { readBaseline, sizeBaselineText } from '../scripts/sizeGate/baselineFile.ts';
import type { SizeBaseline } from '../scripts/sizeGate/limits.ts';
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
