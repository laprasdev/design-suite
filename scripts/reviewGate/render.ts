// The review as the pull request shows it: a verdict line, what couldn't be checked, then each finding linked to its
// line in the head commit.
import { SEVERITIES, type Finding, type Review, type Verdict } from './findings.ts';

const VERDICT_TITLE: Record<Verdict, string> = {
  approve: 'Approve', fix_first: 'Fix first', reject: 'Reject', not_reviewed: 'Not reviewed',
};

/** Where the reviewed commit lives, so each finding links to the exact line it cites. */
export type Commit = { server: string; repository: string; sha: string };

/** The verdict and the count of each severity found, e.g. "Fix first: 1 blocker, 2 minor". */
export function verdictLine(review: Review): string {
  const counts = SEVERITIES.flatMap(severity => {
    const count = review.findings.filter(finding => finding.severity === severity).length;
    return count ? [`${count} ${severity}`] : [];
  });
  const title = VERDICT_TITLE[review.verdict];
  return counts.length ? `${title}: ${counts.join(', ')}` : title;
}

/** The commit status state each verdict sets. not_reviewed is GitHub's error: the check did not happen. */
const STATUS_STATE: Record<Verdict, 'success' | 'failure' | 'error'> = {
  approve: 'success', fix_first: 'failure', reject: 'failure', not_reviewed: 'error',
};

/** The commit status a review sets: its state, and why the change wasn't reviewed or else the verdict line. */
export const commitStatus = (review: Review) => ({
  state: STATUS_STATE[review.verdict],
  description: review.verdict === 'not_reviewed' ? review.reason : verdictLine(review),
});

const bySeverity = (a: Finding, b: Finding) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);

function renderFinding(finding: Finding, commit: Commit): string {
  const where = `${finding.path}:${finding.line}`;
  const link = `${commit.server}/${commit.repository}/blob/${commit.sha}/${finding.path}#L${finding.line}`;
  return [
    `### ${finding.severity} · [${where}](${link})`,
    `**Rule:** ${finding.rule}`,
    `**Problem:** ${finding.problem}`,
    `**Failure:** ${finding.failure}`,
    `**Fix:** ${finding.fix}`,
  ].join('\n\n');
}

const renderUnverified = (unverified: string[]): string[] =>
  unverified.length ? [['**Not checked here:**', ...unverified.map(item => `- ${item}`)].join('\n')] : [];

/** The review body: the verdict, why it wasn't reviewed, the commit and the models that reviewed it, what couldn't be
 * checked, then the findings, most severe first. */
export function renderReview(review: Review, commit: Commit, models: string[]): string {
  const reason = review.verdict === 'not_reviewed' ? [review.reason] : [];
  const reviewed = `Reviewed at ${commit.sha} by ${models.join(', ')}.`;
  const findings = [...review.findings].sort(bySeverity).map(finding => renderFinding(finding, commit));
  return [`## ${verdictLine(review)}`, ...reason, reviewed, ...renderUnverified(review.unverified), ...findings]
    .join('\n\n') + '\n';
}
