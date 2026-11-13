import type {ActionBarNotice} from '../ActionBar.tsx';
import {MODEL_PREVIEW_TEXT, MODEL_REST_POSE, MODEL_STAGE} from './model.ts';
import type {ModelPreviewAsset, ModelStageCamera, ModelStageController, ModelStageDisplay} from './model.ts';
import {MODEL_ACTOR_ANIMATION, type ModelStageActor, type ModelStageActorAnimation} from './actorModel.ts';
import type {ModelPresentationPose} from './placementModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import {MODEL_STAGE_SIZE, type ModelStageSize} from './sizeModel.ts';
import type {ModelEnvironment} from './environment.ts';
import {MODEL_STAGE_THEME_LIGHTING, type ModelStageLighting} from './lightingModel.ts';
import type {ModelStageMaterialMode} from './materialModel.ts';
import type {ModelFrameStatus} from './frameInbox.ts';
import {MODEL_STAGE_FAILURE, ModelStageRefusal, type ModelStageFailure} from './refusal.ts';

/** The person's choices in the view. */
export interface ModelPreviewSelection {
  readonly animation: ModelStageActorAnimation;
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

const AUTHORED_SURFACE: ModelStageMaterialMode = 'lit';
// The local view shows each model at the catalog's one height; the engine's stage keeps the file's real sizes.
const CATALOG_SIZE: ModelStageSize = Object.freeze({rule: MODEL_STAGE_SIZE.normalized,
  height: MODEL_STAGE.normalizedHeight});
const REAL_SIZE: ModelStageSize = Object.freeze({rule: MODEL_STAGE_SIZE.real});
// The selected model stands at the stage's origin, upright and at its own scale: stated whole, like every placement.
const FOCUSED_PLACEMENT: ModelPresentationPose = Object.freeze({position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]} as const);

const REST: ModelStageActorAnimation = Object.freeze({kind: MODEL_ACTOR_ANIMATION.rest});
export const MODEL_PREVIEW_SELECTION_REFUSAL = Object.freeze({
  rest: 'The rest pose neither plays nor pauses.',
  untimed: 'Engine samples drive the pose: there is no clip time to hold.',
});

// The idle clip plays from the start; under reduced motion the stage's one time holds it, so the view holds nothing.
export const modelPreviewInitialSelection = (asset: ModelPreviewAsset, external: boolean): ModelPreviewSelection =>
  Object.freeze({
    animation: external || asset.idleAnimation === MODEL_REST_POSE ? REST :
      {kind: MODEL_ACTOR_ANIMATION.playing, name: asset.idleAnimation},
    display: 'model', materialMode: AUTHORED_SURFACE, lighting: MODEL_STAGE_THEME_LIGHTING,
  });

/** A change to the selection. */
export const modelPreviewSelection = (previous: ModelPreviewSelection,
  change: Partial<ModelPreviewSelection>): ModelPreviewSelection => Object.freeze({...previous, ...change});

/** The clip the picker shows: a clip's name, or the rest pose. */
export const modelPreviewClip = (value: ModelStageActorAnimation) =>
  value.kind === MODEL_ACTOR_ANIMATION.rest ? MODEL_REST_POSE : value.name;

/** A clip picked from the list: it plays if the previous one played, and is otherwise held at its start. */
export function modelPreviewPick(previous: ModelStageActorAnimation, name: string): ModelStageActorAnimation {
  if (name === MODEL_REST_POSE) return REST;
  return previous.kind === MODEL_ACTOR_ANIMATION.playing ? {kind: MODEL_ACTOR_ANIMATION.playing, name} :
    {kind: MODEL_ACTOR_ANIMATION.held, name, timeSeconds: 0};
}

/** Play or pause: a pause holds the clip at the time the stage shows, which the caller reads from its snapshot. */
export function modelPreviewToggle(value: ModelStageActorAnimation, shownSeconds: number | null):
  ModelStageActorAnimation {
  if (value.kind === MODEL_ACTOR_ANIMATION.rest) throw new ModelStageRefusal(MODEL_PREVIEW_SELECTION_REFUSAL.rest);
  if (value.kind === MODEL_ACTOR_ANIMATION.held) return {kind: MODEL_ACTOR_ANIMATION.playing, name: value.name};
  if (shownSeconds === null) throw new ModelStageRefusal(MODEL_PREVIEW_SELECTION_REFUSAL.untimed);
  return {kind: MODEL_ACTOR_ANIMATION.held, name: value.name, timeSeconds: shownSeconds};
}

/** The one description the view sends: the selected model is the focused actor, beside the consumer's actors. */
export function modelPreviewDescription(inputs: ModelPreviewInputs,
  selection: ModelPreviewSelection): ModelStageDescription {
  const {asset, external} = inputs;
  const animation = external ? REST : selection.animation;
  return {
    actors: {focus: asset.id,
      actors: [{id: asset.id, asset, placement: FOCUSED_PLACEMENT, animation}, ...inputs.actors]},
    environment: inputs.environment ?? null, camera: inputs.camera ?? null,
    lighting: external ? MODEL_STAGE_THEME_LIGHTING : selection.lighting, display: selection.display,
    materialMode: external ? AUTHORED_SURFACE : selection.materialMode, size: external ? REAL_SIZE : CATALOG_SIZE,
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
