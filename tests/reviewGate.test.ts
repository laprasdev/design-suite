import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, it } from 'node:test';
import { findingsSchema, readReview, type Finding, type Review } from '../scripts/reviewGate/findings.ts';
import { commitStatus, renderReview, verdictLine } from '../scripts/reviewGate/render.ts';

const REPORT = fileURLToPath(new URL('../scripts/reviewGate/report.ts', import.meta.url));
const COMMIT = { server: 'https://github.com', repository: 'owner/repo', sha: 'abc123' };
const MODELS = ['claude-fable-5-1'];
/** The action's execution file for a session whose result used `models`. */
const execution = (models: string[]) => JSON.stringify([{ type: 'system', subtype: 'init' },
  { type: 'result', modelUsage: Object.fromEntries(models.map(model => [model, { contextWindow: 1 }])) }]);
/** A pull request head holding src/a.ts, three lines long. */
const HEAD = mkdtempSync(path.join(tmpdir(), 'review-head-'));
mkdirSync(path.join(HEAD, 'src'));
writeFileSync(path.join(HEAD, 'src/a.ts'), 'one\ntwo\nthree\n');
after(() => rmSync(HEAD, { recursive: true }));

const finding = (severity: Finding['severity'], line = 2): Finding => ({
  severity, line, path: 'src/a.ts', rule: 'Names', problem: 'p', failure: 'f', fix: 'x',
});
const output = (review: Review | Record<string, unknown>) => JSON.stringify(review);
const read = (review: Review | Record<string, unknown>) => readReview(output(review), HEAD);
const assessed = (verdict: string, findings: unknown[]) => ({ verdict, findings, unverified: [] });

describe('reading the reviewer output', () => {
  it('reads a review whose verdict follows from its findings', () => {
    const review: Review = { verdict: 'fix_first', findings: [finding('minor'), finding('major')], unverified: ['x'] };
    assert.deepEqual(read(review), review);
    assert.equal(read(assessed('approve', [finding('minor')])).findings.length, 1);
  });
  it('refuses an approval that reports a blocker or major finding, and a refusal that reports none', () => {
    for (const [verdict, severity] of [['approve', 'blocker'], ['approve', 'major'], ['fix_first', 'minor'],
      ['reject', 'minor']] as const) {
      assert.throws(() => read(assessed(verdict, [finding(severity)])), /review output: verdict must be/);
    }
  });
  it('reads not_reviewed only with a reason of one line short enough for the commit status', () => {
    const review = read({ ...assessed('not_reviewed', [finding('major')]), reason: 'The diff was cut off.' });
    assert.equal(review.verdict === 'not_reviewed' && review.reason, 'The diff was cut off.');
    for (const reason of [undefined, '', 'two\nlines', 'x'.repeat(141)]) {
      assert.throws(() => read({ ...assessed('not_reviewed', []), reason }), /review output: reason must be/);
    }
    assert.throws(() => read({ ...assessed('approve', []), reason: 'r' }), /reason must be left out/);
  });
  it('refuses a finding with a missing, empty or malformed field', () => {
    const broken: Record<string, unknown>[] = [
      { ...finding('minor'), fix: undefined }, { ...finding('minor'), rule: '' },
      { ...finding('minor'), severity: 'nit' }, { ...finding('minor'), line: 0 }, { ...finding('minor'), line: 1.5 },
    ];
    for (const item of broken) {
      assert.throws(() => read(assessed('approve', [item])), /review output: findings\[0]\.\w+ must be/);
    }
  });
  it('refuses a finding that cites a line the head does not have', () => {
    for (const [cited, message] of [
      [{ ...finding('minor'), line: 4 }, /findings\[0]\.line must be at most 3, the last line of src\/a\.ts/],
      [{ ...finding('minor'), path: '../review.md' }, /findings\[0]\.path must be inside the head/],
      [{ ...finding('minor'), path: 'src/b.ts' }, /findings\[0]\.path must be a file in the head, not src\/b\.ts/],
      [{ ...finding('minor'), path: 'src' }, /findings\[0]\.path must be a file in the head, not src\./],
    ] as const) {
      assert.throws(() => read(assessed('approve', [cited])), message);
    }
  });
  it('refuses an unknown verdict, lists that are not lists, and output that is not JSON', () => {
    assert.throws(() => read(assessed('lgtm', [])), /verdict must be one of/);
    assert.throws(() => read({ verdict: 'approve', findings: {}, unverified: [] }), /findings must be a list/);
    assert.throws(() => read({ verdict: 'approve', findings: [], unverified: [''] }), /unverified\[0] must be text/);
    assert.throws(() => readReview('Approve.', HEAD), /the output must be JSON/);
  });
});

describe('the findings schema', () => {
  const items = findingsSchema.properties.findings.items;
  it('requires every field the reader reads, and no other', () => {
    assert.deepEqual([...items.required].sort(), Object.keys(finding('minor')).sort());
    assert.deepEqual(Object.keys(items.properties).sort(), Object.keys(finding('minor')).sort());
  });
  it('serializes without a single quote, so the workflow can quote it in claude_args', () => {
    assert.doesNotMatch(JSON.stringify(findingsSchema), /'/);
  });
});

describe('rendering the review', () => {
  it('states the verdict and counts each severity found', () => {
    assert.equal(verdictLine({ verdict: 'approve', findings: [], unverified: [] }), 'Approve');
    const review: Review = { verdict: 'fix_first', findings: [finding('minor'), finding('blocker'), finding('minor')],
      unverified: [] };
    assert.equal(verdictLine(review), 'Fix first: 1 blocker, 2 minor');
    assert.deepEqual(commitStatus(review), { state: 'failure', description: 'Fix first: 1 blocker, 2 minor' });
  });
  it('gives a not_reviewed reason as the status, and lists what could not be checked', () => {
    const review: Review = { verdict: 'not_reviewed', reason: 'The diff was cut off.', findings: [],
      unverified: ['Before and after captures'] };
    assert.deepEqual(commitStatus(review), { state: 'error', description: 'The diff was cut off.' });
    assert.match(renderReview(review, COMMIT, MODELS),
      /^## Not reviewed\n\nThe diff was cut off\.\n\nReviewed at abc123 by claude-fable-5-1\.\n[^]*- Before and after/);
  });
  it('lists the most severe finding first, linked to its line in the head commit', () => {
    const review: Review = { verdict: 'reject', findings: [finding('minor', 3), finding('blocker', 1)],
      unverified: [] };
    const body = renderReview(review, COMMIT, MODELS);
    assert.ok(body.indexOf('### blocker') < body.indexOf('### minor'));
    assert.match(body, /\[src\/a\.ts:1]\(https:\/\/github\.com\/owner\/repo\/blob\/abc123\/src\/a\.ts#L1\)/);
  });
});

describe('the report step', () => {
  /** Runs report.ts with REVIEW_OUTPUT set to `raw` and the session's execution file holding `session`. */
  const report = (raw: string, session: string) => {
    const input = mkdtempSync(path.join(tmpdir(), 'review-input-'));
    const files = { body: path.join(input, 'review.md'), output: path.join(input, 'output') };
    writeFileSync(files.output, '');
    writeFileSync(path.join(input, 'execution.json'), session);
    const env = {
      ...process.env, REVIEW_OUTPUT: raw, HEAD_DIR: HEAD, REVIEW_INPUT: input, GITHUB_OUTPUT: files.output,
      GITHUB_SERVER_URL: COMMIT.server, GITHUB_REPOSITORY: COMMIT.repository, HEAD_SHA: COMMIT.sha,
      EXECUTION_FILE: path.join(input, 'execution.json'),
    };
    const run = spawnSync(process.execPath, [REPORT], { env, encoding: 'utf8' });
    const body = existsSync(files.body) ? readFileSync(files.body, 'utf8') : '';
    const result = { status: run.status, stderr: run.stderr, output: readFileSync(files.output, 'utf8'), body, files };
    rmSync(input, { recursive: true });
    return result;
  };

  it('writes the review and records that a major finding blocks the merge', () => {
    const result = report(output(assessed('fix_first', [finding('major', 3)])), execution(MODELS));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, `state=failure\ndescription=Fix first: 1 major\nbody=${result.files.body}\n`);
    assert.match(result.body, /^## Fix first: 1 major\n/);
  });
  it('records success when nothing blocks, and an error when the change was not reviewed', () => {
    assert.match(report(output(assessed('approve', [finding('minor', 1)])), execution(MODELS)).output,
      /^state=success\n/);
    const notReviewed = report(output({ ...assessed('not_reviewed', []), reason: 'Too large to read.' }),
      execution(MODELS));
    assert.match(notReviewed.output, /^state=error\ndescription=Too large to read\.\n/);
  });
  it('refuses empty, non-JSON and contradictory output, and writes nothing', () => {
    for (const [raw, message] of [
      ['', /the workflow must set REVIEW_OUTPUT/],
      ['{"verdict":', /the output must be JSON/],
      [output(assessed('approve', [finding('blocker')])), /verdict must be fix_first or reject/],
    ] as const) {
      const result = report(raw, execution(MODELS));
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, message);
      assert.deepEqual([result.output, result.body], ['', '']);
    }
  });
  it('names the models that served the review, and refuses a session that names none', () => {
    const approved = output(assessed('approve', []));
    assert.match(report(approved, execution(['claude-opus-5-5'])).body, /^Reviewed at abc123 by claude-opus-5-5\.$/m);
    for (const [session, message] of [
      [execution([]), /execution file: must hold a result message that names the models it used/],
      ['[{"type":', /execution file: must be JSON/],
    ] as const) {
      const result = report(approved, session);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, message);
      assert.deepEqual([result.output, result.body], ['', '']);
    }
  });
});
