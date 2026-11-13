import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createModelStage} from './stage.ts';
import type {ModelPreviewAsset, ModelStageController, ModelStageOptions, ModelStageTheme} from './model.ts';
import type {ModelStageCamera, ModelEnvironment} from './model.ts';
import type {ModelPreviewFrame, ModelStageActor} from './actorModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import {createModelFrameInbox, type ModelFrameStatus} from './frameInbox.ts';
import {createModelDescriptionRequests, modelPreviewDescription, modelPreviewFailure, modelPreviewInitialSelection,
  modelPreviewNotice, modelPreviewPick, modelPreviewReady, modelPreviewSelection, modelPreviewToggle,
  type ModelPreviewSelection} from './previewDescription.ts';
import {MODEL_STAGE_FAILURE, modelStageFailure, type ModelStageFailure} from './refusal.ts';

type Scene = {camera?: ModelStageCamera | null; environment?: ModelEnvironment | null};
const NO_ACTORS: readonly ModelStageActor[] = Object.freeze([]);
const key = (value: ModelStageDescription) => JSON.stringify(value);

// The view model: one selection state, one description built from it and the props, one failure reader.
export function useModelPreview(asset: ModelPreviewAsset, theme: ModelStageTheme,
  reviewKey: string, options: Omit<ModelStageOptions, 'reviewKey' | 'clock'> = {},
  frame?: ModelPreviewFrame | null, scene: Scene = {}, actors: readonly ModelStageActor[] = NO_ACTORS) {
  const external = frame !== undefined;
  const [inbox] = useState(createModelFrameInbox);
  const [poseStatus, setPoseStatus] = useState<ModelFrameStatus>('waiting');
  const attachments = JSON.stringify(Object.entries(asset.attachments).sort(([a], [b]) => a.localeCompare(b)));
  const centerOnFloor = external ? false : options.centerOnFloor;
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ModelStageController | null>(null);
  const release = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false), [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState(() => modelPreviewInitialSelection(asset, external));
  const selected = useRef(selection);
  const [boneCount, setBoneCount] = useState(0);
  const [materialAvailable, setMaterialAvailable] = useState(false), [emissiveCount, setEmissiveCount] = useState(0);
  // A refused request and the frame's own failure are kept apart: accepting one never clears the other.
  const [failure, setFailure] = useState<ModelStageFailure | null>(null);
  const [frameFailure, setFrameFailure] = useState<ModelStageFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const inputs = useRef({asset, actors, external, ...scene});
  inputs.current = {asset, actors, external, ...scene};
  const describe = (value: ModelPreviewSelection) => modelPreviewDescription(inputs.current, value);
  const description = describe(selection), described = key(description);
  const latest = useRef(description), staged = useRef(described);
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
  const [requests] = useState(() => createModelDescriptionRequests(setLoading, value => read(value)));
  const send = (api: ModelStageController, value: ModelStageDescription) => {
    if (!requests.request(api, value)) return false;
    staged.current = key(value);
    settled();
    return true;
  };
  // A change of the props sends the description again; one equal by value is no change.
  useLayoutEffect(() => {
    latest.current = description;
    if (controller.current && staged.current !== described) send(controller.current, description);
  }, [described]);
  useLayoutEffect(() => {
    if (external) pose(inbox.receive(frame, latest.current.actors.actors));
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
    if (api && !send(api, describe(next))) return;
    selected.current = next;
    setSelection(next);
  };
  // Play or pause, read against the time the stage shows; a refusal goes to the one reader.
  const toggle = () => {
    const api = controller.current;
    if (!api) return;
    try {choose({animation: modelPreviewToggle(selected.current.animation, api.snapshot().time)});}
    catch (value) {read(value);}
  };
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let active = true, dispose = () => {};
    setReady(false);
    usable.current = true;
    setFailure(null);
    setFrameFailure(null);
    setLoading(false);
    staged.current = key(latest.current);
    try {
      dispose = createModelStage(node, latest.current, theme, api => {
        if (!active) return;
        controller.current = api;
        if (staged.current !== key(latest.current)) send(api, latest.current);
        const snapshot = api.snapshot();
        setBoneCount(snapshot.boneCount);
        setMaterialAvailable(snapshot.materialInspectionAvailable);
        setEmissiveCount(snapshot.emissiveMaterialCount);
        if (external) pose(inbox.attach(value => api.setFrame(value)));
        setReady(true);
      }, value => {if (active) read(value, false);}, {...options, centerOnFloor,
        reviewKey, clock: external ? 'external' : 'local'});
      release.current = dispose;
    } catch (value) {read(value, false);}
    return () => {
      active = false;
      controller.current = null;
      inbox.detach();
      dispose();
      if (release.current === dispose) release.current = () => {};
    };
  }, [asset.id, asset.path, asset.revision, asset.sha256, attachments, reviewKey, attempt, external,
    centerOnFloor,
    options.floor, options.grid, options.orbit, theme.colors.stage, theme.colors.text, theme.colors.surface,
    theme.colors.surfaceHi, theme.colors.accent, theme.colors.accentDeep, theme.colors.teal]);
  const retry = () => setAttempt(value => value + 1);
  const shown = modelPreviewFailure(failure, frameFailure);
  return {
    host, loaded: ready, ready: modelPreviewReady(ready, external, poseStatus, loading),
    error: shown?.kind === MODEL_STAGE_FAILURE.unusable, failure: shown, notice: modelPreviewNotice(shown, retry),
    selection, boneCount, external, poseStatus, materialAvailable, emissiveCount, choose,
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
