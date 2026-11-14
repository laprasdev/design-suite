// The review as the pull request shows it: a verdict line, then each finding linked to its line in the head commit.
import { SEVERITIES, type Finding, type Review, type Verdict } from './findings.ts';

const VERDICT_TITLE: Record<Verdict, string> = { approve: 'Approve', fix_first: 'Fix first', reject: 'Reject' };

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

/** The review body: the verdict, then the findings, most severe first. */
export function renderReview(review: Review, commit: Commit): string {
  const findings = [...review.findings].sort(bySeverity).map(finding => renderFinding(finding, commit));
  return [`## ${verdictLine(review)}`, `Reviewed at ${commit.sha}.`, ...findings].join('\n\n') + '\n';
}
