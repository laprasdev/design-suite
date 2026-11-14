// Turns the reviewer's structured output into the pull request review and its verdict, for
// .github/workflows/review.yml. findings.ts refuses an output it can't post, and then nothing is written.
import { appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readReview } from './findings.ts';
import { renderReview, statusDescription } from './render.ts';

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`report: the workflow must set ${name}.`);
  return value;
};

const commit = { server: env('GITHUB_SERVER_URL'), repository: env('GITHUB_REPOSITORY'), sha: env('HEAD_SHA') };
const files = { body: path.join(env('REVIEW_INPUT'), 'review.md'), output: env('GITHUB_OUTPUT') };
const review = readReview(env('REVIEW_OUTPUT'), path.resolve(env('HEAD_DIR')));
const description = statusDescription(review);
writeFileSync(files.body, renderReview(review, commit));
const approved = review.verdict === 'approve';
appendFileSync(files.output, `approved=${approved}\ndescription=${description}\nbody=${files.body}\n`);
console.log(description);
