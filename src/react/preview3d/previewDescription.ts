import type {ActionBarNotice} from '../ActionBar.tsx';
import {MODEL_PREVIEW_TEXT, MODEL_REST_POSE} from './model.ts';
import type {ModelStageController, ModelStageDisplay} from './model.ts';
import {MODEL_ACTOR_ANIMATION, modelStageFocus, type ModelStageActorAnimation} from './actorModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import type {ModelStageLighting} from './lightingModel.ts';
import type {ModelStageMaterialMode} from './materialModel.ts';
import type {ModelFrameStatus} from './frameInbox.ts';
import {MODEL_STAGE_FAILURE, ModelStageRefusal, type ModelStageFailure} from './refusal.ts';

/** The person's choices in the view: edits of the host's description, which the view holds. */
export interface ModelPreviewSelection {
  readonly animation: ModelStageActorAnimation;
  readonly display: ModelStageDisplay;
  readonly materialMode: ModelStageMaterialMode;
  readonly lighting: ModelStageLighting;
}

const REST: ModelStageActorAnimation = Object.freeze({kind: MODEL_ACTOR_ANIMATION.rest});
export const MODEL_PREVIEW_SELECTION_REFUSAL = Object.freeze({
  rest: 'The rest pose neither plays nor pauses.',
  untimed: 'Engine samples drive the pose: there is no clip time to hold.',
});

/** The host's own values of what the person may change: the view starts from them, and a change of them resets it. */
export const modelPreviewSelectionOf = (host: ModelStageDescription): ModelPreviewSelection => Object.freeze({
  animation: modelStageFocus(host.actors).animation,
  display: host.display, materialMode: host.materialMode, lighting: host.lighting,
});

/** The person's choices as the view holds them, beside the host's values they were made over. */
export interface ModelPreviewChoices {readonly over: ModelPreviewSelection; readonly selection: ModelPreviewSelection}
/** The choices that stand: the person's, until the host changes one of the values they edit; then the host's. */
export function modelPreviewChoices(held: ModelPreviewChoices, host: ModelStageDescription): ModelPreviewChoices {
  const over = modelPreviewSelectionOf(host);
  return JSON.stringify(over) === JSON.stringify(held.over) ? held : Object.freeze({over, selection: over});
}

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

/** The one description the view sends: the host's, with the person's choices applied to it and its focused actor. */
export function modelPreviewDescription(host: ModelStageDescription,
  selection: ModelPreviewSelection): ModelStageDescription {
  const {animation, display, materialMode, lighting} = selection;
  return {...host, display, materialMode, lighting, actors: {focus: host.actors.focus,
    actors: host.actors.actors.map(actor => actor.id === host.actors.focus ? {...actor, animation} : actor)}};
}

const descriptionKey = (value: ModelStageDescription) => JSON.stringify(value);
/** Whether the stage already shows a declared description: it holds that one, and no load is about to replace it. */
export const modelPreviewHeld = (declared: ModelStageDescription, held: ModelStageDescription | undefined,
  loading: boolean) => !loading && held !== undefined && descriptionKey(declared) === descriptionKey(held);

// The view's side of setDescription. It knows the description the stage holds: the first, once the stage is ready,
// then each one applied, at once or when its loads arrive. Only the latest call reports; its failure goes to the
// view's one reader, and every taken or already-held description clears a recorded refusal through `settled`.
export function createModelDescriptionRequests(pending: (value: boolean) => void,
  failure: (error: unknown) => void, settled: () => void) {
  let latest = 0, loading = false, held: ModelStageDescription | undefined;
  const load = (value: boolean) => {loading = value; pending(value);};
  /** Whether the stage took the description: applied at once, or loading. A refusal is handed on. */
  const request = (api: Pick<ModelStageController, 'setDescription' | 'snapshot'>, value: ModelStageDescription) => {
    let applied: Promise<void>;
    try {applied = api.setDescription(value);}
    catch (error) {failure(error); return false;}
    // A refused call supersedes nothing; a taken one is the latest.
    const call = ++latest, current = () => call === latest;
    settled();
    // A description that loads nothing has already been applied: readiness does not drop for it.
    if (!api.snapshot().actorsPending) {held = value; load(false); return true;}
    load(true);
    applied.then(() => {if (current()) {held = value; load(false);}},
      (error: unknown) => {if (!current()) return; load(false); failure(error);});
    return true;
  };
  return {
    request,
    /** The stage was created from this description and is now ready: it holds it. */
    hold(value: ModelStageDescription) {held = value;},
    /** A newly declared description: one the stage already shows only clears a recorded refusal; any other is sent. */
    declare(api: Pick<ModelStageController, 'setDescription' | 'snapshot'>, value: ModelStageDescription) {
      if (!modelPreviewHeld(value, held, loading)) return request(api, value);
      settled();
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
