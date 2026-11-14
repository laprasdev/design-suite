// Turns the reviewer's structured output into the pull request review and its verdict, for
// .github/workflows/review.yml. A finding must cite a line that exists in the head, or the report is refused.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { physicalLines } from '../sizeGate/measure.mjs';
import { blockingFindings, readReview, type Finding } from './findings.ts';
import { renderReview, verdictLine } from './render.ts';

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`report: the workflow must set ${name}.`);
  return value;
};

function checkCited(headDir: string, finding: Finding): void {
  const file = path.resolve(headDir, finding.path);
  if (path.relative(headDir, file).startsWith('..')) throw new Error(`report: ${finding.path} is outside the head.`);
  const lines = physicalLines(readFileSync(file, 'utf8')).length;
  if (finding.line > lines) throw new Error(`report: ${finding.path}:${finding.line} is past its last line, ${lines}.`);
}

const review = readReview(env('REVIEW_OUTPUT'));
const headDir = path.resolve(env('HEAD_DIR'));
review.findings.forEach(finding => checkCited(headDir, finding));
const commit = { server: env('GITHUB_SERVER_URL'), repository: env('GITHUB_REPOSITORY'), sha: env('HEAD_SHA') };
writeFileSync(env('REVIEW_BODY'), renderReview(review, commit));
const verdict = verdictLine(review);
appendFileSync(env('GITHUB_OUTPUT'), `approved=${blockingFindings(review).length === 0}\nverdict=${verdict}\n`);
console.log(verdict);
