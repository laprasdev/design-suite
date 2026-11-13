import type {ActionBarNotice} from '../ActionBar.tsx';
import {MODEL_PREVIEW_TEXT, MODEL_REST_POSE} from './model.ts';
import type {ModelPreviewAsset, ModelStageCamera, ModelStageController, ModelStageDisplay} from './model.ts';
import type {ModelStageActor} from './actorModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import type {ModelEnvironment} from './environment.ts';
import type {ModelStageLighting} from './lightingModel.ts';
import type {ModelStageMaterialMode} from './materialModel.ts';
import type {ModelFrameStatus} from './frameInbox.ts';
import {MODEL_STAGE_FAILURE, type ModelStageFailure} from './refusal.ts';

/** The person's choices in the view. */
export interface ModelPreviewSelection {
  readonly animation: string;
  readonly playing: boolean;
  readonly display: ModelStageDisplay;
  readonly materialMode: ModelStageMaterialMode;
  readonly lighting: ModelStageLighting;
}
/** What the consumer supplies around the selected model; an omitted camera fits it and an omitted scenery is none. */
export interface ModelPreviewInputs {
  readonly asset: ModelPreviewAsset;
  readonly actors: readonly ModelStageActor[];
  readonly camera?: ModelStageCamera | null;
  readonly environment?: ModelEnvironment | null;
  /** The engine drives the stage: the host's clip, playback and inspection choices do not apply. */
  readonly external: boolean;
}

// The lighting model exports no default of its own: the stage's theme lighting is named here, once, for the view's
// first choice and for the engine-driven stage. Every other lighting value comes from the model's own options.
const THEME_LIGHTING: ModelStageLighting = 'light';
const AUTHORED_SURFACE: ModelStageMaterialMode = 'lit';

export const modelPreviewInitialSelection = (asset: ModelPreviewAsset, external: boolean,
  reducedMotion: boolean): ModelPreviewSelection => Object.freeze({
  animation: external ? MODEL_REST_POSE : asset.idleAnimation,
  playing: !external && asset.idleAnimation !== MODEL_REST_POSE && !reducedMotion,
  display: 'model', materialMode: AUTHORED_SURFACE, lighting: THEME_LIGHTING,
});

/** A change to the selection; the rest pose never plays. */
export function modelPreviewSelection(previous: ModelPreviewSelection,
  change: Partial<ModelPreviewSelection>): ModelPreviewSelection {
  const next = {...previous, ...change};
  return Object.freeze(next.animation === MODEL_REST_POSE ? {...next, playing: false} : next);
}

/** The one description the view sends: the selected model is the focused actor, beside the consumer's actors. */
export function modelPreviewDescription(inputs: ModelPreviewInputs,
  selection: ModelPreviewSelection): ModelStageDescription {
  const {asset, external} = inputs;
  const animation = external ? {name: MODEL_REST_POSE, playing: false} :
    {name: selection.animation, playing: selection.playing};
  return {
    actors: {focus: asset.id, actors: [{id: asset.id, asset, placement: {}, animation}, ...inputs.actors]},
    environment: inputs.environment ?? null, camera: inputs.camera ?? null,
    lighting: external ? THEME_LIGHTING : selection.lighting, display: selection.display,
    materialMode: external ? AUTHORED_SURFACE : selection.materialMode,
  };
}

// The view's side of setDescription. Only the latest call reports; its failure goes to the view's one reader.
export function createModelDescriptionRequests(pending: (value: boolean) => void,
  failure: (error: unknown) => void) {
  let latest = 0;
  return {
    /** Whether the stage took the description: applied at once, or loading. A refusal is handed on. */
    request(api: Pick<ModelStageController, 'setDescription' | 'snapshot'>, value: ModelStageDescription) {
      let settled: Promise<void>;
      try {settled = api.setDescription(value);}
      catch (error) {failure(error); return false;}
      // A refused call supersedes nothing; a taken one is the latest.
      const call = ++latest, current = () => call === latest;
      // A description that loads nothing has already been applied: readiness does not drop for it.
      pending(api.snapshot().actorsPending);
      settled.then(() => {if (current()) pending(false);},
        (error: unknown) => {if (!current()) return; pending(false); failure(error);});
      return true;
    },
  };
}

/** The failure to show: a stopped stage first, then the frame's own refusal, then a refused request. */
export const modelPreviewFailure = (request: ModelStageFailure | null, frame: ModelStageFailure | null) =>
  request?.kind === MODEL_STAGE_FAILURE.unusable ? request : frame ?? request;

// The ready attribute: loaded, the runtime pose shown when external, and no description loading.
export function modelPreviewReady(loaded: boolean, external: boolean, poseStatus: ModelFrameStatus,
  loading: boolean) {
  return loaded && (!external || poseStatus === 'ready') && !loading;
}

/** The one place a failure becomes visible: what failed in a few words, its own message, and the recovery. */
export function modelPreviewNotice(failure: ModelStageFailure | null, retry: () => void): ActionBarNotice | null {
  if (!failure) return null;
  const stopped = failure.kind === MODEL_STAGE_FAILURE.unusable;
  return {message: stopped ? MODEL_PREVIEW_TEXT.stopped : MODEL_PREVIEW_TEXT.refused, tone: 'error',
    detail: failure.message, ...(stopped && {action: {label: MODEL_PREVIEW_TEXT.retry, onClick: retry}})};
}
