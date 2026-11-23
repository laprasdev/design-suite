import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ALLOCATION_BASELINE, type AllocationAllowance, type AllocationBaseline,
} from '../scripts/baseline/allocationBaseline.ts';
import { SUITE_BASELINE } from '../scripts/size-gate.ts';
import { SIZE_RULE, readBaseline, sizeBaselineText } from '../scripts/sizeGate/baselineFile.ts';
import {
  FILE_LINE_LIMIT, LINE_CHARACTER_LIMIT, type AllowanceGrant, type SizeBaseline,
} from '../scripts/sizeGate/limits.ts';
import { CAST_BASELINE, type CastNumbers } from '../scripts/typeGate/castBaseline.ts';
import { GATE, runGate, type GateRun, type GateTree } from './gateFixture.ts';

const casts = (files: Record<string, CastNumbers>) => ({ [CAST_BASELINE.file]: CAST_BASELINE.format({ files }) });
const allocations = (files: AllocationBaseline['files'], allowances: AllocationBaseline['allowances']) =>
  ({ [ALLOCATION_BASELINE.file]: ALLOCATION_BASELINE.format({ files, allowances }) });
const ONE_CAST = { 'src/a.ts': { casts: 1, nonNullAssertions: 0 } };
const TWO_CASTS = { 'src/a.ts': { casts: 2, nonNullAssertions: 0 } };
const FRAME_MODEL = 'src/react/preview3d/frameModel.ts';
const ALLOCATION_GRANT: AllocationAllowance = {
  path: FRAME_MODEL,
  decision: 'http://workbench.localhost/#demo:ask:mwsvhomelqnv',
};
const baselines = (tree: GateTree) => runGate(GATE.baselines, tree, process.env);

function passes(run: GateRun): void {
  assert.equal(run.status, 0, run.output);
}

function refuses(run: GateRun, expected: RegExp): void {
  assert.equal(run.status, 1, run.output);
  assert.match(run.output, expected);
}

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
    refuses(
      baselines({ base: casts(ONE_CAST), head: casts(TWO_CASTS) }),
      /cast-baseline\.json: src\/a\.ts is \{"casts":2,"nonNullAssertions":0\}, above \{"casts":1,/,
    );
    refuses(
      baselines({ base: casts({}), head: casts(ONE_CAST) }),
      /src\/a\.ts is \{"casts":1,"nonNullAssertions":0\}, above nothing on origin\/main/,
    );
  });

  it('passes a baseline that fell, and one origin/main does not hold yet', () => {
    passes(baselines({ base: casts(TWO_CASTS), head: casts(ONE_CAST) }));
    const fresh = baselines({ base: {}, head: casts(ONE_CAST) });
    passes(fresh);
    assert.match(fresh.output, /cast-baseline\.json is new: origin\/main holds none/);
  });

  it('refuses an uncovered allocation rise, and passes one covered by a new allowance, fallen or new', () => {
    const low = { [FRAME_MODEL]: { extraBytesPerTick: 108 } };
    const high = { [FRAME_MODEL]: { extraBytesPerTick: 128 } };
    refuses(
      baselines({ base: allocations(low, []), head: allocations(high, []) }),
      /allocation-baseline\.json: .* is \{"extraBytesPerTick":128\}, above \{"extraBytesPerTick":108\}.*no allowance/,
    );
    passes(baselines({ base: allocations(low, []), head: allocations(high, [ALLOCATION_GRANT]) }));
    passes(baselines({
      base: { [ALLOCATION_BASELINE.file]: JSON.stringify({ files: low }) },
      head: allocations(high, [ALLOCATION_GRANT]),
    }));
    passes(baselines({ base: allocations(high, []), head: allocations(low, []) }));
    const fresh = baselines({ base: {}, head: allocations(high, []) });
    passes(fresh);
    assert.match(fresh.output, /allocation-baseline\.json is new: origin\/main holds none/);
  });

  it('refuses an allocation rise under an allowance for another file or one origin/main already holds', () => {
    const low = { [FRAME_MODEL]: { extraBytesPerTick: 108 } };
    const high = { [FRAME_MODEL]: { extraBytesPerTick: 128 } };
    const otherFile = [{ ...ALLOCATION_GRANT, path: 'src/react/preview3d/stageModel.ts' }];
    refuses(baselines({ base: allocations(low, []), head: allocations(high, otherFile) }),
      /no allowance origin\/main lacks raises it/);
    const reordered = JSON.stringify({
      files: { [FRAME_MODEL]: { extraBytesPerTick: 120 } },
      allowances: [{ decision: ALLOCATION_GRANT.decision, path: FRAME_MODEL }],
    });
    refuses(
      baselines({ base: allocations(low, [ALLOCATION_GRANT]), head: { [ALLOCATION_BASELINE.file]: reordered } }),
      /no allowance origin\/main lacks raises it/,
    );
  });

  it('passes an allocation entry origin/main does not name, at the maximum it records, and refuses its rise', () => {
    const held = { [FRAME_MODEL]: { extraBytesPerTick: 96 } };
    const entered = { ...held, 'src/react/preview3d/stageModel.ts': { extraBytesPerTick: 4096 } };
    passes(baselines({ base: allocations(held, []), head: allocations(entered, []) }));
    const heldRose = baselines({
      base: allocations(held, []),
      head: allocations({ ...entered, [FRAME_MODEL]: { extraBytesPerTick: 97 } }, []),
    });
    refuses(heldRose, /frameModel\.ts is \{"extraBytesPerTick":97\}, above \{"extraBytesPerTick":96\}/);
    assert.doesNotMatch(heldRose.output, /stageModel\.ts/, 'only the risen entry is refused');
    const risenEntered = { ...entered, 'src/react/preview3d/stageModel.ts': { extraBytesPerTick: 4097 } };
    refuses(
      baselines({ base: allocations(entered, []), head: allocations(risenEntered, []) }),
      /stageModel\.ts is \{"extraBytesPerTick":4097\}, above \{"extraBytesPerTick":4096\}/,
    );
  });

  it('refuses a size entry origin/main does not name', () => {
    refuses(baselines({
      base: { ...sizeBaseline({ files: {}, allowances: [] }), ...source(300, 4) },
      head: { ...sizeBaseline({ files: entry(300), allowances: [] }), ...source(300, 4) },
    }), /src\/a\.ts is \{"lines":300.*above nothing on origin\/main/);
  });

  it('refuses a size baseline that rose, unless an allowance raised it or it fell', () => {
    refuses(raised(303, source(303, 7), []), /size-baseline\.json: src\/a\.ts is \{"lines":303/);
    passes(raised(303, source(303, 7)));
    passes(raised(290, source(290, 6), []));
    refuses(raised(304, source(304, 7)), /it grew by 1 lines that aren't imports/);
  });

  it('reads origin/main\'s baseline without the retired fields, and refuses one in the working tree\'s', () => {
    const files = { 'src/a.ts': { lines: 300, longLines: 1, importLines: 4 } };
    const base = { ...casts({}), [SUITE_BASELINE]: JSON.stringify({ ...SUITE_SIZE, files }), ...source(300, 4) };
    const current = sizeBaseline({ files: entry(290), allowances: [] });
    passes(baselines({ base, head: { ...current, ...source(290, 4) } }));
    refuses(baselines({ base, head: source(290, 4) }),
      /size-baseline\.json files\["src\/a\.ts"\] holds importLines; it takes lines/);
  });

  it('reads a size rise by the size gate\'s own cap, so a baseline may record what its file measures', () => {
    const longOnly = { lines: 150, longLines: 1 }, over = { lines: 300, longLines: 1 };
    assert.equal(SIZE_RULE.rose(longOnly, { lines: FILE_LINE_LIMIT, longLines: 1 }), false);
    assert.equal(SIZE_RULE.rose(longOnly, { lines: FILE_LINE_LIMIT + 1, longLines: 1 }), true);
    assert.equal(SIZE_RULE.rose(over, { lines: 301, longLines: 1 }), true);
    assert.equal(SIZE_RULE.rose(over, { lines: 300, longLines: 2 }), true);
  });
});

describe('a size allowance, held to the import lines measured in both files', () => {
  it('refuses lines that are not imports, or an empty reason, under a hand-written allowance', () => {
    refuses(raised(464, source(464, 4)),
      /src\/a\.ts is .*; a baseline only falls, and it grew by 164 lines that aren't imports/);
    refuses(raised(303, source(303, 7), [{ ...ALLOWANCE, reason: '' }]),
      /allowances\[0\]\.reason must be a non-empty string/);
  });

  it('passes the import lines a split added, and refuses when they do not cover the rise or are on origin/main', () => {
    passes(raised(303, source(303, 7)));
    refuses(raised(303, source(303, 4)), /and it grew by 3 lines that aren't imports/);
    const allowed = { ...sizeBaseline({ files: entry(300), allowances: [ALLOWANCE] }), ...source(300, 4) };
    const head = { ...sizeBaseline({ files: entry(303), allowances: [ALLOWANCE] }), ...source(303, 7) };
    refuses(baselines({ base: allowed, head }), /no allowance origin\/main lacks raises it/);
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
