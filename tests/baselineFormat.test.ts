import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { Reading } from '../scripts/baseline/baselinedFiles.ts';
import { run } from '../scripts/size-gate.ts';
import { readBaseline, sizeBaselineText } from '../scripts/sizeGate/baselineFile.ts';
import type { SizeBaseline } from '../scripts/sizeGate/limits.ts';
import { parseCastBaseline } from '../scripts/typeGate/castBaseline.ts';

const SCOPE = { dirs: ['src'], files: [], extensions: ['.ts'], skip: { directories: [], suffixes: [] } };
const GRANT = { path: 'src/a.ts', step: '1', reason: 'a split', date: '2026-11-02' };
/** A baseline in the current format. */
const CURRENT: SizeBaseline = {
  scope: SCOPE,
  files: { 'src/a.ts': { lines: 259, longLines: 1 }, 'src/b.ts': { lines: 40, longLines: 3 } },
  allowances: [GRANT],
};
/** The same baseline as the format that recorded import lines wrote it. */
const EARLIER = {
  scope: SCOPE,
  files: {
    'src/a.ts': { lines: 259, longLines: 1, importLines: 14 },
    'src/b.ts': { lines: 40, longLines: 3, importLines: 2 },
  },
  allowances: [{ ...GRANT, from: { lines: 258, importLines: 13 }, to: { lines: 259, importLines: 14 } }],
};
const RETIRED = /which only an earlier format recorded; rewrite the baseline with its gate's --rewrite/;

/** A scratch folder holding `baseline` as its baseline file, passed to `use` and removed after. */
function withBaseline(baseline: unknown, use: (baselinePath: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), 'baseline-format-'));
  const baselinePath = path.join(root, 'baseline.json');
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  try {
    use(baselinePath);
  } finally {
    rmSync(root, { recursive: true });
  }
}

const rewrite = (baselinePath: string) =>
  run({ root: path.dirname(baselinePath), baselinePath, scope: SCOPE, argv: ['--rewrite'], log: () => {} });

describe('reading a size baseline', () => {
  it('refuses each field only an earlier format recorded, naming the file, the entry and the field', () => {
    withBaseline(EARLIER, baselinePath => {
      const entry = new RegExp(`size-gate: ${baselinePath} files\\["src/a.ts"\\] holds importLines, `);
      assert.throws(() => readBaseline(baselinePath, Reading.CURRENT), entry);
      assert.throws(() => readBaseline(baselinePath, Reading.CURRENT), RETIRED);
    });
    withBaseline({ ...CURRENT, allowances: EARLIER.allowances }, baselinePath => {
      assert.throws(() => readBaseline(baselinePath, Reading.CURRENT), /allowances\[0\] holds from, which only/);
    });
  });

  it('refuses a field no format took, however it is read', () => {
    const extra = { ...CURRENT, files: { 'src/a.ts': { lines: 259, longLines: 1, words: 3 } } };
    for (const reading of [Reading.CURRENT, Reading.REWRITE]) {
      withBaseline(extra, baselinePath => assert.throws(() => readBaseline(baselinePath, reading),
        /files\["src\/a\.ts"\] holds words; it takes lines, longLines\./));
      withBaseline({ ...CURRENT, notes: 'x' }, baselinePath => assert.throws(() => readBaseline(baselinePath, reading),
        /the baseline holds notes; it takes scope, files, allowances\./));
    }
  });

  it('refuses a cast baseline field it does not take, by name', () => {
    const value = { files: { 'src/a.ts': { casts: 1, nonNullAssertions: 0, importLines: 2 } } };
    assert.throws(() => parseCastBaseline(value, 'casts.json', Reading.CURRENT),
      /type gate: casts\.json files\["src\/a\.ts"\] holds importLines; it takes casts, nonNullAssertions\./);
  });
});

describe('the size gate\'s --rewrite', () => {
  it('drops only the retired fields, keeping every number and allowance as it is', () => {
    withBaseline(EARLIER, baselinePath => {
      assert.equal(rewrite(baselinePath), 0);
      assert.equal(readFileSync(baselinePath, 'utf8'), sizeBaselineText(CURRENT));
      assert.deepEqual(readBaseline(baselinePath, Reading.CURRENT), CURRENT);
      assert.equal(rewrite(baselinePath), 0);
      assert.equal(readFileSync(baselinePath, 'utf8'), sizeBaselineText(CURRENT), 'a current baseline is unchanged');
    });
  });

  it('refuses a field no format took, writing nothing', () => {
    const extra = { ...EARLIER, notes: 'x' };
    withBaseline(extra, baselinePath => {
      const before = readFileSync(baselinePath, 'utf8');
      assert.throws(() => rewrite(baselinePath), /the baseline holds notes/);
      assert.equal(readFileSync(baselinePath, 'utf8'), before);
    });
  });
});
