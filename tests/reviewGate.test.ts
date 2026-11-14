import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { findingsSchema, readReview, type Finding, type Review } from '../scripts/reviewGate/findings.ts';
import { renderReview, verdictLine } from '../scripts/reviewGate/render.ts';

const REPORT = fileURLToPath(new URL('../scripts/reviewGate/report.ts', import.meta.url));
const COMMIT = { server: 'https://github.com', repository: 'owner/repo', sha: 'abc123' };
const finding = (severity: Finding['severity'], line = 2): Finding => ({
  severity, line, path: 'src/a.ts', rule: 'Names', problem: 'p', failure: 'f', fix: 'x',
});
const output = (review: Review | Record<string, unknown>) => JSON.stringify(review);

describe('reading the reviewer output', () => {
  it('reads a review whose verdict follows from its findings', () => {
    const review: Review = { verdict: 'fix_first', findings: [finding('minor'), finding('major')] };
    assert.deepEqual(readReview(output(review)), review);
    assert.equal(readReview(output({ verdict: 'approve', findings: [finding('minor')] })).findings.length, 1);
  });
  it('refuses an approval that reports a blocker or major finding', () => {
    for (const severity of ['blocker', 'major'] as const) {
      assert.throws(() => readReview(output({ verdict: 'approve', findings: [finding(severity)] })), /contradicts/);
    }
  });
  it('refuses fix first or reject when nothing blocks', () => {
    for (const verdict of ['fix_first', 'reject'] as const) {
      assert.throws(() => readReview(output({ verdict, findings: [finding('minor')] })), /contradicts/);
    }
  });
  it('refuses a finding with a missing, empty or malformed field', () => {
    const broken: Record<string, unknown>[] = [
      { ...finding('minor'), fix: undefined }, { ...finding('minor'), rule: '' },
      { ...finding('minor'), severity: 'nit' }, { ...finding('minor'), line: 0 }, { ...finding('minor'), line: 1.5 },
    ];
    for (const item of broken) {
      assert.throws(() => readReview(output({ verdict: 'approve', findings: [item] })), /review output: findings\[0]/);
    }
  });
  it('refuses an unknown verdict and findings that are not a list', () => {
    assert.throws(() => readReview(output({ verdict: 'lgtm', findings: [] })), /verdict must be one of/);
    assert.throws(() => readReview(output({ verdict: 'approve', findings: {} })), /findings must be a list/);
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
    assert.equal(verdictLine({ verdict: 'approve', findings: [] }), 'Approve');
    const review: Review = { verdict: 'fix_first', findings: [finding('minor'), finding('blocker'), finding('minor')] };
    assert.equal(verdictLine(review), 'Fix first: 1 blocker, 2 minor');
  });
  it('lists the most severe finding first, linked to its line in the head commit', () => {
    const body = renderReview({ verdict: 'reject', findings: [finding('minor', 3), finding('blocker', 7)] }, COMMIT);
    assert.ok(body.indexOf('### blocker') < body.indexOf('### minor'));
    assert.match(body, /\[src\/a\.ts:7]\(https:\/\/github\.com\/owner\/repo\/blob\/abc123\/src\/a\.ts#L7\)/);
  });
});

describe('the report step', () => {
  /** Runs report.ts on a head holding src/a.ts, three lines long. */
  const report = (review: Review | Record<string, unknown>) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'review-gate-'));
    const head = path.join(dir, 'pr');
    mkdirSync(path.join(head, 'src'), { recursive: true });
    writeFileSync(path.join(head, 'src/a.ts'), 'one\ntwo\nthree\n');
    const files = { body: path.join(dir, 'review.md'), output: path.join(dir, 'output') };
    writeFileSync(files.output, '');
    const env = {
      ...process.env, REVIEW_OUTPUT: output(review), HEAD_DIR: head, REVIEW_BODY: files.body,
      GITHUB_OUTPUT: files.output, GITHUB_SERVER_URL: COMMIT.server, GITHUB_REPOSITORY: COMMIT.repository,
      HEAD_SHA: COMMIT.sha,
    };
    const run = spawnSync(process.execPath, [REPORT], { env, encoding: 'utf8' });
    const written = { body: existsSync(files.body) ? readFileSync(files.body, 'utf8') : '' };
    const result = { status: run.status, stderr: run.stderr, output: readFileSync(files.output, 'utf8'), ...written };
    rmSync(dir, { recursive: true });
    return result;
  };
  const cited = (file: string, line: number) =>
    ({ verdict: 'fix_first', findings: [{ ...finding('major', line), path: file }] });

  it('writes the review and records that a major finding blocks the merge', () => {
    const result = report(cited('src/a.ts', 3));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'approved=false\nverdict=Fix first: 1 major\n');
    assert.match(result.body, /^## Fix first: 1 major\n/);
  });
  it('records approval when nothing blocks', () => {
    const result = report({ verdict: 'approve', findings: [finding('minor', 1)] });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, 'approved=true\nverdict=Approve: 1 minor\n');
  });
  it('refuses a finding that cites a line the head does not have, and writes nothing', () => {
    for (const [where, message] of [
      [cited('src/a.ts', 4), /src\/a\.ts:4 is past its last line, 3/],
      [cited('../review.md', 1), /\.\.\/review\.md is outside the head/],
      [cited('src/b.ts', 1), /ENOENT/],
    ] as const) {
      const result = report(where);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, message);
      assert.deepEqual([result.output, result.body], ['', '']);
    }
  });
});
