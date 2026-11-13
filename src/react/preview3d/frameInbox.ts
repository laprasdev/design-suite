import {modelFrameScope, modelPreviewFrame, type ModelPreviewFrame} from './frameModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import {modelSurfaceKinds, type ModelSurfaceKind} from './surfaceKindModel.ts';

export type ModelFrameStatus = 'waiting' | 'pending' | 'ready' | 'error';

// A loaded stage consumes only the latest validated frame; publication and session policy belong to its host.
export function createModelFrameInbox() {
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
    // Validated against the declared actors and the kinds the stage is given: an entity must name one of them, match
    // its model, and state only values its renderers take.
    receive(value: unknown, declared: Pick<ModelStageDescription, 'actors' | 'surfaceSets'>,
      kinds: readonly ModelSurfaceKind[]): ModelFrameStatus {
      if (value === null) {pending = null; status = 'waiting'; failure = undefined; return status;}
      try {pending = modelPreviewFrame(value, modelFrameScope(declared, modelSurfaceKinds(kinds)));}
      catch (error) {return refuse(error);}
      return applyPending();
    },
    attach(consume: (value: ModelPreviewFrame) => void) {apply = consume; return applyPending();},
    detach() {apply = null; if (pending) status = 'pending';},
    clear() {pending = null; apply = null; status = 'waiting'; failure = undefined;},
  };
}
