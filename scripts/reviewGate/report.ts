// Turns the reviewer's structured output into the pull request review and its verdict, for
// .github/workflows/review.yml. findings.ts refuses an output it can't post, execution.ts a session that names no
// model, and then nothing is written.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readModels } from './execution.ts';
import { readReview } from './findings.ts';
import { commitStatus, renderReview } from './render.ts';

const env = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`report: the workflow must set ${name}.`);
  return value;
};

const commit = { server: env('GITHUB_SERVER_URL'), repository: env('GITHUB_REPOSITORY'), sha: env('HEAD_SHA') };
const files = { body: path.join(env('REVIEW_INPUT'), 'review.md'), output: env('GITHUB_OUTPUT') };
const review = readReview(env('REVIEW_OUTPUT'), path.resolve(env('HEAD_DIR')));
const models = readModels(readFileSync(env('EXECUTION_FILE'), 'utf8'));
const status = commitStatus(review);
writeFileSync(files.body, renderReview(review, commit, models));
appendFileSync(files.output, `state=${status.state}\ndescription=${status.description}\nbody=${files.body}\n`);
console.log(`${status.state}: ${status.description}`);
