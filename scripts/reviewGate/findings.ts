// What the pull request reviewer returns: its findings and the verdict they lead to. One definition serves both sides:
// the JSON schema Claude Code holds the reviewer's output to, and the reader the workflow applies before posting it.

export const SEVERITIES = ['blocker', 'major', 'minor'] as const;
export const VERDICTS = ['approve', 'fix_first', 'reject'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type Verdict = (typeof VERDICTS)[number];

/** A finding's text fields, each with the description the reviewer reads in the schema. */
const FINDING_TEXT = {
  path: 'Repository-relative path of the file in the pull request head, as the diff names it.',
  rule: 'The written rule broken, named with its source: shared rules, reviewer house style or repository AGENTS.md. '
    + 'For a minor finding no rule covers, the rule you propose.',
  problem: 'What is wrong at this line.',
  failure: 'A concrete scenario in which this fails, or misleads a caller or reader.',
  fix: 'The change that resolves it.',
} as const;

export type Finding = Record<keyof typeof FINDING_TEXT, string> & { severity: Severity; line: number };
export type Review = { verdict: Verdict; findings: Finding[] };

/** The severities that block a merge. A review that reports any of them cannot approve. */
const BLOCKING: ReadonlySet<Severity> = new Set(['blocker', 'major']);

export const findingsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'findings'],
  properties: {
    verdict: {
      type: 'string', enum: VERDICTS,
      description: 'approve only when no blocker or major finding remains; '
        + 'reject when the approach itself must change; fix_first otherwise.',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'line', ...Object.keys(FINDING_TEXT)],
        properties: {
          severity: { type: 'string', enum: SEVERITIES },
          line: {
            type: 'integer', minimum: 1, description: 'Line number in the pull request head version of the file.',
          },
          ...Object.fromEntries(Object.entries(FINDING_TEXT).map(([field, description]) =>
            [field, { type: 'string', minLength: 1, description }])),
        },
      },
    },
  },
};

export const blockingFindings = (review: Review): Finding[] => review.findings.filter(({ severity }) =>
  BLOCKING.has(severity));

const fail = (where: string, expected: string): never => {
  throw new Error(`review output: ${where} must be ${expected}.`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const oneOf = <T extends string>(values: readonly T[], value: unknown, where: string): T =>
  values.find(option => option === value) ?? fail(where, `one of ${values.join(', ')}`);

const readText = (value: unknown, where: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fail(where, 'text');

const readLine = (value: unknown, where: string): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fail(where, 'a line number');

function readFinding(value: unknown, where: string): Finding {
  if (!isRecord(value)) return fail(where, 'an object');
  const text = (field: keyof typeof FINDING_TEXT) => readText(value[field], `${where}.${field}`);
  return {
    severity: oneOf(SEVERITIES, value.severity, `${where}.severity`),
    line: readLine(value.line, `${where}.line`),
    path: text('path'), rule: text('rule'), problem: text('problem'), failure: text('failure'), fix: text('fix'),
  };
}

/** Reads the reviewer's output, refusing one whose verdict contradicts its own findings. */
export function readReview(json: string): Review {
  const value: unknown = JSON.parse(json);
  if (!isRecord(value)) return fail('the output', 'an object');
  if (!Array.isArray(value.findings)) return fail('findings', 'a list');
  const review: Review = {
    verdict: oneOf(VERDICTS, value.verdict, 'verdict'),
    findings: value.findings.map((finding: unknown, index) => readFinding(finding, `findings[${index}]`)),
  };
  const blocking = blockingFindings(review).length;
  if ((review.verdict === 'approve') !== (blocking === 0)) {
    throw new Error(`review output: verdict ${review.verdict} contradicts its ${blocking} blocker and major findings.`);
  }
  return review;
}
