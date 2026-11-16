import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parseBaseline, readBaseline } from '../scripts/sizeGate/baselineFile.ts';
import type { SizeBaseline } from '../scripts/sizeGate/limits.ts';
import { parseWithoutRetiredFields } from '../scripts/sizeGate/retiredFields.ts';
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

/** Both reads of a size baseline: every reader's, and the base branch's, which drops the retired fields. */
const READS = [parseBaseline, parseWithoutRetiredFields];

describe('reading a size baseline', () => {
  it('refuses each field only an earlier format recorded, naming the file, the entry and the field', () => {
    withBaseline(EARLIER, baselinePath => {
      const entry = new RegExp(`size-gate: ${baselinePath} files\\["src/a.ts"\\] holds importLines; it takes lines`);
      assert.throws(() => readBaseline(baselinePath), entry);
    });
    withBaseline({ ...CURRENT, allowances: EARLIER.allowances }, baselinePath => {
      assert.throws(() => readBaseline(baselinePath), /allowances\[0\] holds from; it takes path, step, reason, date/);
    });
  });

  it('refuses a field no format took, however it is read', () => {
    const extra = { ...CURRENT, files: { 'src/a.ts': { lines: 259, longLines: 1, words: 3 } } };
    for (const read of READS) {
      assert.throws(() => read(extra, 'b.json'), /files\["src\/a\.ts"\] holds words; it takes lines, longLines\./);
      assert.throws(() => read({ ...CURRENT, notes: 'x' }, 'b.json'),
        /the baseline holds notes; it takes scope, files, allowances\./);
      assert.throws(() => read({ ...CURRENT, scope: { ...SCOPE, skip: { suffixes: [] } } }, 'b.json'),
        /size-gate: b\.json scope\.skip\.directories must be a list\./);
    }
  });

  it('refuses a cast baseline field it does not take, by name', () => {
    const value = { files: { 'src/a.ts': { casts: 1, nonNullAssertions: 0, importLines: 2 } } };
    assert.throws(() => parseCastBaseline(value, 'casts.json'),
      /type gate: casts\.json files\["src\/a\.ts"\] holds importLines; it takes casts, nonNullAssertions\./);
  });
});

describe('the base branch\'s read', () => {
  it('drops only the retired fields, keeping every number and allowance as it is', () => {
    assert.deepEqual(parseWithoutRetiredFields(EARLIER, 'b.json'), CURRENT);
    assert.deepEqual(parseWithoutRetiredFields(CURRENT, 'b.json'), CURRENT, 'a current baseline reads as it is');
  });
});
