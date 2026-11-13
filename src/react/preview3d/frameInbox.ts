import {modelFrameScope, modelPreviewFrame, type ModelFrameScope, type ModelPreviewFrame} from './frameModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import {modelSurfaceKinds, type ModelSurfaceKind} from './surfaceKindModel.ts';
import {ModelStageRefusal} from './refusal.ts';

export type ModelFrameStatus = 'waiting' | 'pending' | 'ready' | 'error';
export const MODEL_FRAME_INBOX_TEXT = Object.freeze({
  undescribed: 'A frame was received before the inbox was told the description it is checked against.',
});

// A loaded stage consumes only the latest validated frame; publication and session policy belong to its host. What a
// frame is checked against (the declared actors and what their renderers take, frameModel.ts) is built when the
// description or the kinds change, never per frame; a description whose scope is refused refuses every frame with it.
export function createModelFrameInbox() {
  let checked: {readonly scope: ModelFrameScope} | {readonly refusal: ModelStageRefusal} | undefined;
  let pending: ModelPreviewFrame | null = null;
  let apply: ((value: ModelPreviewFrame) => void) | null = null;
  let status: ModelFrameStatus = 'waiting';
  // What failed while the status is 'error', for the host to read by its kind; cleared by the next accepted one.
  let failure: unknown;
  const refuse = (error: unknown) => {
    pending = null; status = 'error'; failure = error;
    return status;
  };
  const applyPending = () => {
    if (!pending) return status;
    try {
      apply?.(pending);
      status = apply ? 'ready' : 'pending';
      failure = undefined;
    } catch (error) {refuse(error);}
    return status;
  };
  return {
    get status() {return status;},
    get failure() {return failure;},
    /** The declared description and the kinds the stage is given changed: frames are checked against them now. */
    describe(declared: Pick<ModelStageDescription, 'actors' | 'surfaceSets'>, kinds: readonly ModelSurfaceKind[]) {
      try {
        checked = {scope: modelFrameScope(declared, modelSurfaceKinds(kinds))};
      } catch (error) {
        if (!(error instanceof ModelStageRefusal)) throw error;
        checked = {refusal: error};
      }
    },
    // Validated against the scope described: an entity must name a declared actor, match its model, and state only
    // values its renderers take.
    receive(value: unknown): ModelFrameStatus {
      if (value === null) {pending = null; status = 'waiting'; failure = undefined; return status;}
      if (!checked) throw new Error(MODEL_FRAME_INBOX_TEXT.undescribed);
      if ('refusal' in checked) return refuse(checked.refusal);
      try {pending = modelPreviewFrame(value, checked.scope);} catch (error) {return refuse(error);}
      return applyPending();
    },
    attach(consume: (value: ModelPreviewFrame) => void) {apply = consume; return applyPending();},
    detach() {apply = null; if (pending) status = 'pending';},
    clear() {pending = null; apply = null; status = 'waiting'; failure = undefined;},
  };
}
