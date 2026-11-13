import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {reducedMotion, REDUCED_MOTION_QUERY} from '../motion.ts';
import {createModelStage} from './stage.ts';
import {MODEL_REST_POSE} from './model.ts';
import type {ModelPreviewAsset, ModelStageController, ModelStageDisplay, ModelStageOptions} from './model.ts';
import type {ModelStageTheme, ModelStageMaterialMode, ModelStageLighting} from './model.ts';
import type {ModelStageCamera, ModelEnvironment} from './model.ts';
import {createModelPresentationInbox, modelPreviewCamera} from './presentation.ts';
import {modelEnvironment} from './environment.ts';
import type {ModelPreviewPresentation, ModelPresentationStatus} from './presentation.ts';
import type {ModelStageActor} from './actorModel.ts';
import {createModelActorReplacement, modelPreviewReady} from './actorReplacement.ts';
import {MODEL_STAGE_FAILURE, modelStageFailure, type ModelStageFailure} from './refusal.ts';

type Scene = {camera?: ModelStageCamera | null; environment?: ModelEnvironment | null};
function prepareScene(scene: Scene): Scene {
  return Object.freeze({camera: scene.camera == null ? scene.camera : modelPreviewCamera(scene.camera),
    environment: scene.environment == null ? scene.environment : modelEnvironment(scene.environment)});
}
function applyScene(api: ModelStageController, scene: Scene, previous?: Scene) {
  if (scene.environment !== undefined && (!previous ||
    JSON.stringify(scene.environment) !== JSON.stringify(previous.environment))) api.setEnvironment(scene.environment);
  if (scene.camera !== undefined) {
    if (scene.camera) api.setCamera(scene.camera);
    else api.resetCamera();
  }
}

const NO_ACTORS: readonly ModelStageActor[] = Object.freeze([]);
export function useModelPreview(asset: ModelPreviewAsset, theme: ModelStageTheme,
  reviewKey: string, options: Omit<ModelStageOptions, 'reviewKey' | 'clock' | 'actors'> = {},
  presentation?: ModelPreviewPresentation | null,
  scene: Scene = {}, actors: readonly ModelStageActor[] = NO_ACTORS) {
  const external = presentation !== undefined;
  const [inbox] = useState(() => createModelPresentationInbox(asset.id, asset.runtimeMaterials));
  const [poseStatus, setPoseStatus] = useState<ModelPresentationStatus>('waiting');
  const attachments = JSON.stringify(Object.entries(asset.attachments).sort(([a], [b]) => a.localeCompare(b)));
  const normalizeHeight = external ? null : options.normalizeHeight;
  const centerOnFloor = external ? false : options.centerOnFloor;
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<ModelStageController | null>(null);
  const release = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const [animation, setAnimation] = useState(external ? MODEL_REST_POSE : asset.idleAnimation);
  const [playing, setPlaying] = useState(() =>
    !external && asset.idleAnimation !== MODEL_REST_POSE && !reducedMotion());
  const [display, setDisplay] = useState<ModelStageDisplay>('model');
  const [boneCount, setBoneCount] = useState(0);
  const [materialMode, setMaterialMode] = useState<ModelStageMaterialMode>('lit');
  const [materialAvailable, setMaterialAvailable] = useState(false), [emissiveCount, setEmissiveCount] = useState(0);
  const [lighting, setLighting] = useState<ModelStageLighting>('light');
  const selected = useRef({animation, playing, display, materialMode, lighting});
  const latestScene = useRef<Scene>({});
  const [failure, setFailure] = useState<ModelStageFailure | null>(null);
  const [actorsPending, setActorsPending] = useState(false);
  // Whether a created stage is there to keep when a request is refused.
  const usable = useRef(true);
  // The one place a failure is read, decided by its kind: a refusal leaves the stage as it was and is recorded;
  // anything else, or any failure with no stage to keep (creation, onError), fails the stage and is recorded too.
  const read = (value: unknown, stageKept = usable.current) => {
    const next = modelStageFailure(value, stageKept);
    setFailure(next);
    if (next.kind === MODEL_STAGE_FAILURE.unusable) failed();
  };
  const settled = () => setFailure(value => value?.kind === MODEL_STAGE_FAILURE.refused ? null : value);
  const request = (run: () => void) => {
    try {run(); settled(); return true;}
    catch (value) {read(value); return false;}
  };
  const pose = (status: ModelPresentationStatus) => {
    setPoseStatus(status);
    if (status === 'error') read(inbox.failure);
    else settled();
  };
  const [replacement] = useState(() => createModelActorReplacement(setActorsPending, value => read(value)));
  // The set the stage holds or is loading; a change while it loads is sent once the stage is ready.
  // Compared by value, as attachments and the environment are: a parent's new array of the same actors is no change.
  const actorsKey = JSON.stringify(actors);
  const latestActors = useRef(actors), stagedActors = useRef(actorsKey);
  useLayoutEffect(() => {
    latestActors.current = actors;
    if (!controller.current || stagedActors.current === actorsKey) return;
    stagedActors.current = actorsKey;
    replacement.request(controller.current, actors);
  }, [actorsKey, replacement]);
  useLayoutEffect(() => {
    if (external) pose(inbox.receive(presentation));
  }, [external, inbox, presentation]);
  useEffect(() => () => inbox.clear(), [inbox]);
  function failed() {
    usable.current = false;
    controller.current = null;
    setReady(false);
    setError(true);
    inbox.detach();
    release.current();
  }
  const command = (run: (api: ModelStageController) => void) => {
    const api = controller.current;
    return api ? request(() => run(api)) : false;
  };
  useLayoutEffect(() => {
    request(() => {
      const accepted = prepareScene(scene);
      if (controller.current) applyScene(controller.current, accepted, latestScene.current);
      latestScene.current = accepted;
    });
  }, [scene.camera, scene.environment]);
  const changePlaying = (value: boolean) => {
    if (controller.current && !command(api => api.setPlaying(value))) return;
    selected.current.playing = value;
    setPlaying(value);
  };
  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const changed = () => {if (media.matches) changePlaying(false);};
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let active = true, dispose = () => {};
    setReady(false);
    setError(false);
    stagedActors.current = JSON.stringify(latestActors.current);
    usable.current = true;
    setFailure(null);
    setActorsPending(false);
    try {
      dispose = createModelStage(node, asset, theme, api => {
        if (!active) return;
        controller.current = api;
        api.setAnimation(external ? MODEL_REST_POSE : selected.current.animation);
        api.setPlaying(external ? false : selected.current.playing);
        api.setDisplay(selected.current.display);
        api.setMaterialMode(external ? 'lit' : selected.current.materialMode);
        api.setLighting(external ? 'light' : selected.current.lighting);
        const snapshot = api.snapshot();
        setBoneCount(snapshot.boneCount);
        setMaterialAvailable(snapshot.materialInspectionAvailable);
        setEmissiveCount(snapshot.emissiveMaterialCount);
        applyScene(api, latestScene.current);
        if (stagedActors.current !== JSON.stringify(latestActors.current)) {
          stagedActors.current = JSON.stringify(latestActors.current);
          replacement.request(api, latestActors.current);
        }
        if (external) pose(inbox.attach(value => api.setPresentation(value)));
        setReady(true);
      }, value => {if (active) read(value, false);}, {...options, normalizeHeight, centerOnFloor,
        reviewKey, clock: external ? 'external' : 'local', actors: latestActors.current});
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
    normalizeHeight, centerOnFloor,
    options.floor, options.grid, options.orbit, theme.colors.stage, theme.colors.text, theme.colors.surface,
    theme.colors.surfaceHi, theme.colors.accent, theme.colors.accentDeep, theme.colors.teal]);
  return {
    host, loaded: ready, ready: modelPreviewReady(ready, external, poseStatus, actorsPending),
    error, failure, animation, playing, display, boneCount, external, poseStatus,
    materialMode, materialAvailable, emissiveCount, lighting,
    chooseAnimation(value: string) {
      if (external) return;
      if (!command(api => api.setAnimation(value))) return;
      selected.current.animation = value;
      setAnimation(value);
      if (value === MODEL_REST_POSE) changePlaying(false);
    },
    chooseDisplay(value: ModelStageDisplay) {
      if (!command(api => api.setDisplay(value))) return;
      selected.current.display = value;
      setDisplay(value);
    },
    chooseMaterialMode(value: ModelStageMaterialMode) {
      if (external || !command(api => api.setMaterialMode(value))) return;
      selected.current.materialMode = value;
      setMaterialMode(value);
    },
    chooseLighting(value: ModelStageLighting) {
      if (external || !command(api => api.setLighting(value))) return;
      selected.current.lighting = value;
      setLighting(value);
    },
    togglePlayback: () => {if (!external) changePlaying(!playing);},
    resetCamera() {
      const camera = latestScene.current.camera;
      command(api => camera ? api.setCamera(camera) : api.resetCamera());
    },
    retry: () => setAttempt(value => value + 1),
  };
}
