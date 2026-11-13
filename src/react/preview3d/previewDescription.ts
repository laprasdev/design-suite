import type {ActionBarNotice} from '../ActionBar.tsx';
import {MODEL_PREVIEW_TEXT, MODEL_REST_POSE} from './model.ts';
import type {ModelStageController, ModelStageDisplay} from './model.ts';
import {MODEL_ACTOR_ANIMATION, modelStageFocus, type ModelStageActorAnimation} from './actorModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import type {ModelStageSurfaceMode} from './surfaceModeModel.ts';
import {modelStageLighting, modelStageTimeOptions} from './lightingModel.ts';
import type {ModelFrameStatus} from './frameInbox.ts';
import {MODEL_STAGE_FAILURE, ModelStageRefusal, type ModelStageFailure} from './refusal.ts';

/** The person's choices in the view: edits of the host's description, which the view holds. */
export interface ModelPreviewSelection {
  readonly animation: ModelStageActorAnimation;
  readonly display: ModelStageDisplay;
  readonly surfaceMode: ModelStageSurfaceMode;
  /** The id of the time of day in force; the times themselves are the host's. */
  readonly lighting: string;
}

const REST: ModelStageActorAnimation = Object.freeze({kind: MODEL_ACTOR_ANIMATION.rest});
export const MODEL_PREVIEW_SELECTION_REFUSAL = Object.freeze({
  rest: 'The rest pose neither plays nor pauses.',
  untimed: 'Engine samples drive the pose: there is no clip time to hold.',
});

/** The host's own values of what the person may change: the view starts from them, and a change of them resets it. */
export const modelPreviewSelectionOf = (host: ModelStageDescription): ModelPreviewSelection => Object.freeze({
  animation: modelStageFocus(host.actors).animation,
  display: host.display, surfaceMode: host.surfaceMode, lighting: host.lighting.time,
});

/** The person's choices as the view holds them, beside the host's values they were made over. */
export interface ModelPreviewChoices {readonly over: ModelPreviewSelection; readonly selection: ModelPreviewSelection}
/**
 * The choices that stand: the person's, until the host changes one of the values they edit; then the host's. A choice
 * of time is a choice among the times that exist: when the host's times no longer hold the chosen one, there is no
 * such choice any more, and the host's time in force stands in its place, so no description names a time that is not.
 */
export function modelPreviewChoices(held: ModelPreviewChoices, host: ModelStageDescription): ModelPreviewChoices {
  const over = modelPreviewSelectionOf(host);
  if (JSON.stringify(over) !== JSON.stringify(held.over)) return Object.freeze({over, selection: over});
  const offered = modelStageTimeOptions(host.lighting).some(({value}) => value === held.selection.lighting);
  return offered ? held : Object.freeze({over, selection: Object.freeze({...held.selection, lighting: over.lighting})});
}

/**
 * The person's choices as the view holds them. Each host description is read through `modelPreviewChoices` and what
 * stands is kept, so a reset to the host's value lasts: a host that later declares its old value again does not
 * bring back a choice it replaced.
 */
export function createModelPreviewChoices(host: ModelStageDescription) {
  const first = modelPreviewSelectionOf(host);
  let choices: ModelPreviewChoices = Object.freeze({over: first, selection: first});
  return {
    /** The selection to declare over this host description. */
    declared(value: ModelStageDescription) {
      choices = modelPreviewChoices(choices, value);
      return choices.selection;
    },
    /** A choice the stage took, made over this host description. */
    take(value: ModelStageDescription, selection: ModelPreviewSelection) {
      choices = Object.freeze({over: modelPreviewSelectionOf(value), selection});
    },
  };
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

/**
 * The Lighting control's options: the host's times once the stage's own check accepts them. A host lighting the stage
 * refuses reaches the person as the stage's refusal of the description, in the notice, and the control then offers
 * the times of the description the stage holds, or none before it holds one; it is never read unchecked.
 */
export function modelPreviewTimes(host: unknown, held: ModelStageDescription | undefined) {
  try {
    return modelStageTimeOptions(modelStageLighting(host));
  } catch (error) {
    if (!(error instanceof ModelStageRefusal)) throw error;
    return held ? modelStageTimeOptions(held.lighting) : [];
  }
}

/** The one description the view sends: the host's, with the person's choices applied to it and its focused actor. */
export function modelPreviewDescription(host: ModelStageDescription,
  selection: ModelPreviewSelection): ModelStageDescription {
  const {animation, display, surfaceMode, lighting} = selection;
  return {...host, display, surfaceMode, lighting: {...host.lighting, time: lighting},
    actors: {focus: host.actors.focus, actors: host.actors.actors.map(actor =>
      actor.id === host.actors.focus ? {...actor, animation} : actor)}};
}

const descriptionKey = (value: ModelStageDescription) => JSON.stringify(value);
// A refusal is recorded only against a stage that holds a description: the first, once it is ready.
const UNHELD = 'A refusal was recorded before the stage held any description.';
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
    /** The description the stage holds, once it holds one. */
    get held() {return held;},
    /** The stage was created from this description and is now ready: it holds it. */
    hold(value: ModelStageDescription) {held = value;},
    /**
     * What the controls show and act on: the declared selection, or, while a refusal stands, the selection of the
     * description the stage holds, since a refused description changed nothing on it.
     */
    shown(declared: ModelPreviewSelection, refused: boolean): ModelPreviewSelection {
      if (!refused) return declared;
      if (!held) throw new Error(UNHELD);
      return modelPreviewSelectionOf(held);
    },
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
