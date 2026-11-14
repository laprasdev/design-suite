// What the pull request reviewer returns, and the refusal of anything else. One definition serves both sides: the
// JSON schema Claude Code holds the reviewer's output to, and the reader the workflow applies before posting it.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { modelIsNamed, modelIsRecord } from '../../src/react/preview3d/recordModel.ts';
import { physicalLines } from '../sizeGate/measure.mjs';

export const SEVERITIES = ['blocker', 'major', 'minor'] as const;
export const VERDICTS = ['approve', 'fix_first', 'reject', 'not_reviewed'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type Verdict = (typeof VERDICTS)[number];

/** GitHub refuses a commit status description longer than this, and a not_reviewed reason becomes one. */
const STATUS_DESCRIPTION_LIMIT = 140;

/** A finding's text fields, each with the description the reviewer reads in the schema. */
const FINDING_TEXT = {
  path: 'Repository-relative path of the file in the pull request head, as the diff names it.',
  rule: 'The written rule broken, named with its source: shared rules, reviewer house style or repository AGENTS.md. '
    + 'For a minor finding no rule covers, the rule you propose.',
  problem: 'What is wrong at this line.',
  failure: 'A concrete scenario in which this fails, or misleads a caller or reader.',
  fix: 'The change that resolves it.',
} as const;
type TextField = keyof typeof FINDING_TEXT;
const TEXT_FIELDS = Object.keys(FINDING_TEXT) as TextField[];

export type Finding = Record<TextField, string> & { severity: Severity; line: number };
type Assessment = { findings: Finding[]; unverified: string[] };
export type Review = Assessment & (
  { verdict: Exclude<Verdict, 'not_reviewed'> } | { verdict: 'not_reviewed'; reason: string });

/** The severities that block a merge. A review that reports any of them cannot approve. */
const BLOCKING: ReadonlySet<Severity> = new Set(['blocker', 'major']);

const text = (description: string) => ({ type: 'string', minLength: 1, description });

export const findingsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'findings', 'unverified'],
  properties: {
    verdict: {
      type: 'string', enum: VERDICTS,
      description: 'approve only when no blocker or major finding remains; reject when the approach itself must '
        + 'change; fix_first otherwise; not_reviewed when you could not read what judging the change needs.',
    },
    reason: {
      ...text('With not_reviewed only, and then required: why, on one line. It becomes the commit status.'),
      maxLength: STATUS_DESCRIPTION_LIMIT,
    },
    unverified: {
      type: 'array',
      items: text('Something judging the change needs that you could not check here, such as captures or a skill.'),
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'line', ...TEXT_FIELDS],
        properties: {
          severity: { type: 'string', enum: SEVERITIES },
          line: {
            type: 'integer', minimum: 1, description: 'Line number in the pull request head version of the file.',
          },
          ...Object.fromEntries(TEXT_FIELDS.map(field => [field, text(FINDING_TEXT[field])])),
        },
      },
    },
  },
};

/** Every refusal of the reviewer's output: where it was refused, and what that part must be instead. */
const refuse = (where: string, expected: string): never => {
  throw new Error(`review output: ${where} must be ${expected}.`);
};

const oneOf = <T extends string>(values: readonly T[], value: unknown, where: string): T =>
  values.find(option => option === value) ?? refuse(where, `one of ${values.join(', ')}`);

const readText = (value: unknown, where: string): string => modelIsNamed(value) ? value : refuse(where, 'text');

const readLineNumber = (value: unknown, where: string): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : refuse(where, 'a line number');

const readList = (value: unknown, where: string): unknown[] => Array.isArray(value) ? value : refuse(where, 'a list');

const readTexts = (value: Record<string, unknown>, where: string) => Object.fromEntries(
  TEXT_FIELDS.map(field => [field, readText(value[field], `${where}.${field}`)])) as Record<TextField, string>;

/** A finding, refused unless it cites a line of a file in the head. */
function readFinding(value: unknown, where: string, head: string): Finding {
  if (!modelIsRecord(value)) return refuse(where, 'an object');
  const finding: Finding = {
    severity: oneOf(SEVERITIES, value.severity, `${where}.severity`),
    line: readLineNumber(value.line, `${where}.line`),
    ...readTexts(value, where),
  };
  const file = path.resolve(head, finding.path);
  if (path.relative(head, file).startsWith('..')) refuse(`${where}.path`, `inside the head, not ${finding.path}`);
  if (!existsSync(file) || !statSync(file).isFile()) refuse(`${where}.path`, `a file in the head, not ${finding.path}`);
  const last = physicalLines(readFileSync(file, 'utf8')).length;
  if (finding.line > last) refuse(`${where}.line`, `at most ${last}, the last line of ${finding.path}`);
  return finding;
}

function readReason(value: unknown): string {
  const reason = readText(value, 'reason');
  if (/[\r\n]/.test(reason)) refuse('reason', 'one line');
  if (reason.length > STATUS_DESCRIPTION_LIMIT) refuse('reason', `at most ${STATUS_DESCRIPTION_LIMIT} characters`);
  return reason;
}

/** Reads the reviewer's output, checking each finding against the pull request head at `head`. */
export function readReview(json: string, head: string): Review {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return refuse('the output', 'JSON');
  }
  if (!modelIsRecord(value)) return refuse('the output', 'an object');
  const verdict = oneOf(VERDICTS, value.verdict, 'verdict');
  const assessment: Assessment = {
    findings: readList(value.findings, 'findings').map((finding, index) =>
      readFinding(finding, `findings[${index}]`, head)),
    unverified: readList(value.unverified, 'unverified').map((item, index) => readText(item, `unverified[${index}]`)),
  };
  if (verdict === 'not_reviewed') return { verdict, reason: readReason(value.reason), ...assessment };
  if (value.reason !== undefined) refuse('reason', 'left out unless the verdict is not_reviewed');
  const blocking = assessment.findings.filter(({ severity }) => BLOCKING.has(severity)).length;
  if ((verdict === 'approve') !== (blocking === 0)) {
    refuse('verdict', `${blocking ? 'fix_first or reject' : 'approve'} with ${blocking} blocker and major findings`);
  }
  return { verdict, ...assessment };
}
