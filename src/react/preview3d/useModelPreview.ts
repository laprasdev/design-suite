import {useEffect, useLayoutEffect, useReducer, useRef, useState} from 'react';
import {createModelStage} from './stage.ts';
import type {ModelStageController, ModelStageHold, ModelStageOptions, ModelStageTheme} from './model.ts';
import {REDUCED_MOTION_QUERY} from '../motion.ts';
import type {ModelPreviewFrame} from './actorModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import {createModelFrameInbox, type ModelFrameStatus} from './frameInbox.ts';
import {createModelDescriptionRequests, createModelPreviewChoices, modelPreviewDescription, modelPreviewFailure,
  modelPreviewNotice, modelPreviewPick, modelPreviewReady, modelPreviewSelection, modelPreviewTimes,
  modelPreviewToggle, type ModelPreviewSelection} from './previewDescription.ts';
import {MODEL_STAGE_FAILURE, modelStageFailure, type ModelStageFailure} from './refusal.ts';

/** What the view fixes when it creates its stage: the clock follows whether an engine frame is given. */
export type ModelPreviewStageOptions = Pick<ModelStageOptions, 'floor' | 'grid' | 'kinds'>;

// The view model: the host's description, the person's choices held as edits of it, one failure reader.
export function useModelPreview(host: ModelStageDescription, theme: ModelStageTheme, reviewKey: string,
  options: ModelPreviewStageOptions, frame: ModelPreviewFrame | null | undefined) {
  const external = frame !== undefined;
  const [inbox] = useState(createModelFrameInbox);
  const [poseStatus, setPoseStatus] = useState<ModelFrameStatus>('waiting');
  const hostRef = useRef<HTMLDivElement>(null);
  const controller = useRef<ModelStageController | null>(null);
  const release = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0);
  // The person's choices start from the host's values and are reset, for good, when the host changes one of them.
  const [choices] = useState(() => createModelPreviewChoices(host));
  const [, taken] = useReducer((count: number) => count + 1, 0);
  const declared = choices.declared(host);
  const [boneCount, setBoneCount] = useState(0);
  const [materialAvailable, setMaterialAvailable] = useState(false), [emissiveCount, setEmissiveCount] = useState(0);
  // A refused request and the frame's own failure are kept apart: accepting one never clears the other.
  const [failure, setFailure] = useState<ModelStageFailure | null>(null);
  const [frameFailure, setFrameFailure] = useState<ModelStageFailure | null>(null);
  const [loading, setLoading] = useState(false);
  // Why the stage's time is held: read from its snapshot when it is ready and whenever the page's motion or visibility
  // changes, the two things that hold it.
  const [hold, setHold] = useState<ModelStageHold | null>(null);
  useEffect(() => {
    const read = () => {if (controller.current) setHold(controller.current.snapshot().hold);};
    const motion = matchMedia(REDUCED_MOTION_QUERY);
    motion.addEventListener('change', read);
    document.addEventListener('visibilitychange', read);
    return () => {motion.removeEventListener('change', read); document.removeEventListener('visibilitychange', read);};
  }, []);
  const hostLatest = useRef(host);
  hostLatest.current = host;
  const describe = (value: ModelPreviewSelection) => modelPreviewDescription(hostLatest.current, value);
  const description = describe(declared), described = JSON.stringify(description);
  const latest = useRef(description);
  // Whether a created stage is there to keep when a request is refused.
  const usable = useRef(true);
  // The one place a failure is read, decided by its kind: a refusal leaves the stage as it was and is recorded;
  // anything else, or any failure with no stage to keep (creation, onError), fails the stage and is recorded too.
  const read = (value: unknown, stageKept = usable.current, record = setFailure) => {
    const next = modelStageFailure(value, stageKept);
    record(next);
    if (next.kind === MODEL_STAGE_FAILURE.unusable) failed();
  };
  const settled = () => setFailure(value => value?.kind === MODEL_STAGE_FAILURE.refused ? null : value);
  const pose = (status: ModelFrameStatus) => {
    setPoseStatus(status);
    if (status === 'error') read(inbox.failure, usable.current, setFrameFailure);
    else setFrameFailure(null);
  };
  const [requests] = useState(() => createModelDescriptionRequests(setLoading, value => read(value), settled));
  // The controls show and act on what the stage shows: while a refusal stands, the description it holds.
  const selection = requests.shown(declared, failure?.kind === MODEL_STAGE_FAILURE.refused);
  const selected = useRef(selection);
  selected.current = selection;
  // A change of the declared description: sent, unless the stage already shows it; one equal by value is no change.
  useLayoutEffect(() => {
    latest.current = description;
    if (controller.current) requests.declare(controller.current, description);
  }, [described]);
  useLayoutEffect(() => {
    if (external) pose(inbox.receive(frame, latest.current, options.kinds));
  }, [external, inbox, frame]);
  useEffect(() => () => inbox.clear(), [inbox]);
  function failed() {
    usable.current = false;
    controller.current = null;
    setReady(false);
    inbox.detach();
    release.current();
  }
  // A choice is kept only when the stage took it, or when there is no stage yet to take it.
  const choose = (change: Partial<ModelPreviewSelection>) => {
    const next = modelPreviewSelection(selected.current, change), api = controller.current;
    if (api && !requests.request(api, describe(next))) return;
    selected.current = next;
    choices.take(hostLatest.current, next);
    taken();
  };
  // Play or pause, read against the time the stage shows; a refusal goes to the one reader.
  const toggle = () => {
    const api = controller.current;
    if (!api) return;
    try {choose({animation: modelPreviewToggle(selected.current.animation, api.snapshot().time)});}
    catch (value) {read(value);}
  };
  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    let active = true, dispose = () => {};
    setReady(false);
    usable.current = true;
    setFailure(null);
    setFrameFailure(null);
    setLoading(false);
    const created = latest.current;
    try {
      dispose = createModelStage(node, created, theme, api => {
        if (!active) return;
        controller.current = api;
        requests.hold(created);
        requests.declare(api, latest.current);
        const snapshot = api.snapshot();
        setBoneCount(snapshot.boneCount);
        setMaterialAvailable(snapshot.materialInspectionAvailable);
        setEmissiveCount(snapshot.emissiveMaterialCount);
        setHold(snapshot.hold);
        if (external) pose(inbox.attach(value => api.setFrame(value)));
        setReady(true);
      }, value => {if (active) read(value, false);}, {...options, reviewKey, clock: external ? 'external' : 'local'});
      release.current = dispose;
    } catch (value) {read(value, false);}
    return () => {
      active = false;
      controller.current = null;
      inbox.detach();
      dispose();
      if (release.current === dispose) release.current = () => {};
    };
  // The kinds by value: a host that writes its options inline each render does not make a stage each render.
  }, [reviewKey, attempt, external, options.floor, options.grid, JSON.stringify(options.kinds), theme.colors.stage,
    theme.colors.text,
    theme.colors.surface, theme.colors.surfaceHi, theme.colors.accent, theme.colors.accentDeep, theme.colors.teal]);
  const retry = () => setAttempt(value => value + 1);
  const shown = modelPreviewFailure(failure, frameFailure);
  return {
    host: hostRef, loaded: ready, ready: modelPreviewReady(ready, external, poseStatus, loading),
    error: shown?.kind === MODEL_STAGE_FAILURE.unusable, failure: shown, notice: modelPreviewNotice(shown, retry),
    selection, hold, boneCount, external, poseStatus, materialAvailable, emissiveCount, choose,
    times: modelPreviewTimes(host.lighting, requests.held),
    pick: (name: string) => choose({animation: modelPreviewPick(selected.current.animation, name)}),
    togglePlayback: toggle,
    resetCamera() {
      const api = controller.current;
      if (!api) return;
      try {api.resetCamera(); settled();} catch (value) {read(value);}
    },
    retry,
  };
}
