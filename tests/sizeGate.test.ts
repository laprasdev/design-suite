import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { FILE_LINE_LIMIT, LINE_CHARACTER_LIMIT } from '../scripts/sizeGate/limits.mjs';
import { measureScope, measureText } from '../scripts/sizeGate/measure.mjs';
import { compare } from '../scripts/sizeGate/compare.mjs';
import { allowed, ratcheted, readBaseline } from '../scripts/sizeGate/baselineFile.mjs';
import { run } from '../scripts/size-gate.mjs';

type Numbers = { lines: number; longLines: number; importLines: number };
const SCOPE = {
  dirs: ['src'], files: [], extensions: ['.ts'], skip: { directories: ['__snapshots__'], suffixes: ['.d.ts'] },
};
const LONG = 'x'.repeat(LINE_CHARACTER_LIMIT + 1);
const IMPORT = "import { a } from './a';";
/** A file of `lines` lines, long at the 1-based numbers given, opening with `imports` import lines. */
const file = (lines: number, long: number[] = [], imports = 0) => Array.from({ length: lines }, (_, index) =>
  index < imports ? IMPORT : long.includes(index + 1) ? LONG : 'x').join('\n') + '\n';
const measured = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([name, text]) => [name, measureText(text)]));
const baselineOf = (files: Record<string, Numbers>) => ({ scope: SCOPE, files, allowances: [] });
const problemsOf = (files: Record<string, string>, base: Record<string, Numbers> = {}) =>
  compare(measured(files), baselineOf(base)).problems;
const GRANT = { path: 'src/a.ts', step: '3', reason: 'a split', date: '2026-11-02' };

describe('measuring a file', () => {
  it('counts the lines an editor numbers', () => {
    assert.deepEqual(['', 'a', 'a\n', 'a\n\n', 'a\nb'].map(text => measureText(text).lines), [0, 1, 1, 2, 2]);
  });
  it('counts a line over the limit by its characters, not its bytes', () => {
    assert.equal(measureText(`${'x'.repeat(LINE_CHARACTER_LIMIT)}\n`).longLines, 0);
    assert.deepEqual(measureText(`a\n${LONG}\n`).long, [{ line: 2, characters: LINE_CHARACTER_LIMIT + 1 }]);
    assert.equal(measureText(`${'é'.repeat(LINE_CHARACTER_LIMIT)}\n`).longLines, 0);
  });
  it('counts the lines of import statements, however they wrap', () => {
    const text = ["import React from 'react';", 'import {', '  a,', "} from './a';", "import './b.css';", 'x();'];
    assert.equal(measureText(text.join('\n')).importLines, 5);
    assert.equal(measureText("const x = import('./a');\nimport.meta.url;\n").importLines, 0);
  });
});

describe('rule 1: a file the baseline does not name', () => {
  it('holds the line limit', () => {
    assert.deepEqual(problemsOf({ 'src/a.ts': file(FILE_LINE_LIMIT) }), []);
    assert.match(problemsOf({ 'src/a.ts': file(FILE_LINE_LIMIT + 1) })[0], /201 lines, over the 200-line limit/);
  });
  it('names each line over the character limit', () => {
    assert.deepEqual(problemsOf({ 'src/a.ts': file(3, [2]) }), [
      'src/a.ts:2: 121 characters, over the 120-character limit (not baselined)',
    ]);
  });
});

describe('rule 2: a baselined file', () => {
  const base = { lines: 300, longLines: 2, importLines: 0 };
  it('passes at its baseline', () => {
    assert.deepEqual(problemsOf({ 'src/a.ts': file(300, [1, 2]) }, { 'src/a.ts': base }), []);
  });
  it('gains no long line', () => {
    assert.equal(problemsOf({ 'src/a.ts': file(300, [1, 2, 3]) }, { 'src/a.ts': base }).length, 1);
  });
  it('grows past neither the limit nor its baselined lines', () => {
    assert.match(problemsOf({ 'src/a.ts': file(301, [1, 2]) }, { 'src/a.ts': base })[0], /301 lines, baselined 300/);
    const longOnly = { 'src/b.ts': { lines: 150, longLines: 1, importLines: 0 } };
    assert.deepEqual(problemsOf({ 'src/b.ts': file(FILE_LINE_LIMIT, [1]) }, longOnly), []);
    assert.equal(problemsOf({ 'src/b.ts': file(FILE_LINE_LIMIT + 1, [1]) }, longOnly).length, 1);
  });
});

describe('rule 3 and the ratchet', () => {
  const base = {
    'src/a.ts': { lines: 300, longLines: 2, importLines: 4 },
    'src/b.ts': { lines: 250, longLines: 0, importLines: 0 },
    'src/c.ts': { lines: 220, longLines: 0, importLines: 0 },
  };
  const now = measured({ 'src/a.ts': file(280, [9], 3), 'src/b.ts': file(FILE_LINE_LIMIT) });
  it('passes a shrink, a file that now passes and a deleted one, and says so', () => {
    const { problems, notices } = compare(now, baselineOf(base));
    assert.deepEqual(problems, []);
    assert.deepEqual(notices, [
      'ratchet: src/a.ts fell to 280 lines, 1 long',
      'ratchet: src/b.ts now passes at 200 lines',
      'ratchet: src/c.ts is gone',
    ]);
  });
  it('writes the lower numbers, lines and imports together, and drops what passes or is gone', () => {
    const fell = { lines: 280, longLines: 1, importLines: 3 };
    assert.deepEqual(ratcheted(baselineOf(base), now).files, { 'src/a.ts': fell });
    const fewerLong = measured({ 'src/a.ts': file(300, [9], 2) });
    const kept = { lines: 300, longLines: 1, importLines: 4 };
    assert.deepEqual(ratcheted(baselineOf(base), fewerLong).files['src/a.ts'], kept);
  });
});

describe('an allowance for a split\'s import lines', () => {
  const base = { 'src/a.ts': { lines: 300, longLines: 1, importLines: 4 } };
  it('raises the file by the import lines a split added, and records the step and the reason', () => {
    const grown = measured({ 'src/a.ts': file(303, [10], 7) });
    const next = allowed(baselineOf(base), grown, GRANT);
    assert.deepEqual(next.files['src/a.ts'], { lines: 303, longLines: 1, importLines: 7 });
    const record = { ...GRANT, from: { lines: 300, importLines: 4 }, to: { lines: 303, importLines: 7 } };
    assert.deepEqual(next.allowances, [record]);
    assert.deepEqual(compare(grown, next).problems, []);
  });
  it('refuses any line that is not an import', () => {
    const grown = measured({ 'src/a.ts': file(303, [10], 6) });
    assert.throws(() => allowed(baselineOf(base), grown, GRANT), /1 lines that aren't/);
  });
  it('refuses a long line, a file the baseline does not name, a missing reason, and a file that needs none', () => {
    const cases: [Record<string, string>, typeof GRANT, RegExp][] = [
      [{ 'src/a.ts': file(303, [10, 11], 7) }, GRANT, /long line/],
      [{ 'src/z.ts': file(303, [], 7) }, { ...GRANT, path: 'src/z.ts' }, /only a baselined file/],
      [{ 'src/a.ts': file(303, [10], 7) }, { ...GRANT, reason: '' }, /names the step/],
      [{ 'src/a.ts': file(300, [10], 4) }, GRANT, /needs none/],
    ];
    for (const [files, grant, refusal] of cases) {
      assert.throws(() => allowed(baselineOf(base), measured(files), grant), refusal);
    }
  });
});

describe('the command', () => {
  const quiet = () => {};
  const repo = () => {
    const root = mkdtempSync(path.join(tmpdir(), 'size-gate-'));
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src/a.ts'), file(250));
    return { root, baselinePath: path.join(root, 'baseline.json'), scope: SCOPE, log: quiet };
  };
  it('writes a first baseline once, then fails a scratch long line and writes nothing for it', () => {
    const job = repo();
    assert.equal(run({ ...job, argv: ['--init'] }), 0);
    assert.throws(() => run({ ...job, argv: ['--init'] }), /only shrinks/);
    const before = readFileSync(job.baselinePath, 'utf8');
    writeFileSync(path.join(job.root, 'src/b.ts'), `${LONG}\n`);
    assert.equal(run(job), 1);
    assert.equal(readFileSync(job.baselinePath, 'utf8'), before);
    rmSync(path.join(job.root, 'src/b.ts'));
    assert.equal(run(job), 0);
    rmSync(job.root, { recursive: true });
  });
  it('ratchets a shrink on a pass, and not under --check', () => {
    const job = repo();
    run({ ...job, argv: ['--init'] });
    writeFileSync(path.join(job.root, 'src/a.ts'), file(240));
    assert.equal(run({ ...job, argv: ['--check'] }), 0);
    assert.equal(readBaseline(job.baselinePath).files['src/a.ts'].lines, 250);
    assert.equal(run(job), 0);
    assert.equal(readBaseline(job.baselinePath).files['src/a.ts'].lines, 240);
    rmSync(job.root, { recursive: true });
  });
});

describe('this repo', () => {
  it('holds its own baseline', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const baselinePath = path.join(root, 'scripts/size-baseline.json');
    assert.ok(existsSync(baselinePath));
    const baseline = readBaseline(baselinePath);
    assert.deepEqual(compare(measureScope(root, baseline.scope), baseline).problems, []);
  });
});
