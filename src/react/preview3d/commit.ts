// The stage's one form of "applied whole or refused". A prepare checks everything that can refuse and returns its
// commit; a commit only applies. Every prepare of a change runs before any of its commits, so one refusal leaves
// everything as it was.
export type ModelStageCommit = () => void;
export type ModelStagePrepare = () => ModelStageCommit;
export const MODEL_STAGE_COMMIT_TEXT = Object.freeze({
  partial: 'A checked change failed while it was applied; the stage may show part of it.',
});

/** Applies the first `count` of `commits` in order. A commit that throws has left part of the change applied: never a
 * refusal, which promises nothing changed. Allocates nothing, so a frame applies through it every tick. */
export function applyModelStageCommits(commits: readonly ModelStageCommit[], count: number) {
  try {
    for (let index = 0; index < count; index++) commits[index]();
  } catch (error) {
    throw new Error(MODEL_STAGE_COMMIT_TEXT.partial, {cause: error});
  }
}

export function prepareWhole(prepares: Iterable<ModelStagePrepare>): ModelStageCommit {
  const commits = Array.from(prepares, prepare => prepare());
  return () => applyModelStageCommits(commits, commits.length);
}

/** A commit that applies nothing: what a slot holds before its first prepare. */
export const MODEL_STAGE_UNCHANGED: ModelStageCommit = () => {};

/** A prepare with nothing to check. */
export const modelStageCommit = (commit: ModelStageCommit): ModelStagePrepare => () => commit;
