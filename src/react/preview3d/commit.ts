// The stage's one form of "applied whole or refused". A prepare checks everything that can refuse and returns its
// commit; a commit only applies. Every prepare of a change runs before any of its commits, so one refusal leaves
// everything as it was.
export type ModelStageCommit = () => void;
export type ModelStagePrepare = () => ModelStageCommit;
export const MODEL_STAGE_COMMIT_TEXT = Object.freeze({
  partial: 'A checked change failed while it was applied; the stage may show part of it.',
});

export function prepareWhole(prepares: Iterable<ModelStagePrepare>): ModelStageCommit {
  const commits = Array.from(prepares, prepare => prepare());
  return () => {
    // A commit that throws has left part of the change applied: never a refusal, which promises nothing changed.
    try {
      for (const commit of commits) commit();
    } catch (error) {
      throw new Error(MODEL_STAGE_COMMIT_TEXT.partial, {cause: error});
    }
  };
}

/** A prepare with nothing to check. */
export const modelStageCommit = (commit: ModelStageCommit): ModelStagePrepare => () => commit;
