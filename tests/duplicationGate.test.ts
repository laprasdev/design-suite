import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runGate } from './gateFixture.ts';

/** A function long enough to be a clone: over the 50 tokens and 5 lines .jscpd.json counts. */
const FUNCTION = [
  'export function summarize(scores: number[], floor: number): { total: number; kept: number; best: number } {',
  '  let total = 0;',
  '  let kept = 0;',
  '  let best = Number.NEGATIVE_INFINITY;',
  '  for (const score of scores) {',
  '    if (score < floor) continue;',
  '    total += score;',
  '    kept += 1;',
  '    best = Math.max(best, score);',
  '  }',
  '  return { total, kept, best };',
  '}',
].join('\n') + '\n';
/** A rule set long enough to be a clone. */
const RULES = ['margin: 0 auto;', 'padding: 4px 8px;', 'border: 1px solid currentColor;', 'border-radius: 6px;',
  'display: grid;', 'gap: 4px;', 'align-items: center;', 'font-size: 12px;'].map(line => `  ${line}`).join('\n');

const duplication = (files: Record<string, string>) => runGate('check:duplication', files, process.env);

describe('the duplication gate', () => {
  it('refuses a function copied into a second file', () => {
    const run = duplication({ 'src/one.ts': FUNCTION, 'src/two.ts': FUNCTION });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /Clone found \(typescript\)/);
    assert.match(run.output, /src\/(one|two)\.ts/);
  });
  it('refuses a rule set copied into a second selector', () => {
    const run = duplication({ 'src/panel.css': `.panel {\n${RULES}\n}\n\n.card {\n${RULES}\n}\n` });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /Clone found \(css\)/);
  });
  it('passes the same code written once', () => {
    const run = duplication({ 'src/one.ts': FUNCTION, 'src/panel.css': `.panel {\n${RULES}\n}\n` });
    assert.equal(run.status, 0, run.output);
    assert.match(run.output, /Found 0 clones/);
  });
});
