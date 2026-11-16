// The branch every pull request here merges into: each baseline may only fall from its own there, and an allowance
// raises a file from the version that branch holds.
import { gitSucceeds } from '../repositoryFiles.ts';

export const BASE = { remote: 'origin', branch: 'main' } as const;
export const BASE_BRANCH = `${BASE.remote}/${BASE.branch}`;

/** Why `root` cannot be held to the base branch, saying how to fetch it, or undefined when it has it. */
export function baseBranchAbsence(root: string): string | undefined {
  if (gitSucceeds(root, ['rev-parse', '--verify', '--quiet', `${BASE_BRANCH}^{commit}`])) return undefined;
  const expected = `${BASE_BRANCH}, the branch each baseline may only fall from`;
  return `${root} has no ${expected}; fetch it with git fetch ${BASE.remote} ${BASE.branch}`;
}
