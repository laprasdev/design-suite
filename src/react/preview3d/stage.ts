import * as THREE from 'three';
import {MODEL_STAGE as settings, modelStagePolicy} from './model.ts';
import type {ModelStageAsset, ModelStageController, ModelStageOptions, ModelStageTheme} from './model.ts';
import type {ModelStageDisplay, ModelStageMaterialMode} from './model.ts';
import {disposeModelObject, loadModelStageAsset} from './asset.ts';
import {createModelScene} from './scene.ts';
import {modelRuntimeAssetProfile} from './runtimeMaterialBinding.ts';
import {createModelEnvironment} from './environment.ts';
import {applyModelFrame, createModelActor, MODEL_ACTOR_TEXT, type ModelActor} from './actor.ts';
import {createModelActorSet, MODEL_ACTOR_SET_TEXT} from './actorSet.ts';
import {MODEL_STAGE_DRIVER, modelStageActors} from './actorModel.ts';
import type {ModelPreviewEntity, ModelStageActor} from './actorModel.ts';
import {ModelStageRefusal} from './refusal.ts';

const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));
export const MODEL_STAGE_TEXT = Object.freeze({
  notReady: 'The preview model is not ready.', disposed: 'The preview has been disposed.',
  external: 'Runtime presentation requires an external clock.',
  inspection: (id: string) => `Actor ${id} does not support material inspection.`,
});

export function createModelStage(
  host: HTMLElement, character: ModelStageAsset, theme: ModelStageTheme,
  onReady: (controller: ModelStageController) => void, onError: (error: Error) => void,
  options: ModelStageOptions = {},
): () => void {
  const source = Object.freeze({id: character.id, path: character.path, revision: character.revision,
    attachments: Object.freeze({...character.attachments}), runtimeMaterials: modelRuntimeAssetProfile(character)});
  const policy = modelStagePolicy(options);
  const declaredActors = modelStageActors(options.actors ?? [], source.id);
  const stage = createModelScene(host, theme, policy);
  const request = new AbortController();
  const renderedMeshes = new Set<string>();
  const context = {policy, theme, scene: stage.scene, lighting: stage.lighting,
    rendered: (mesh: THREE.Mesh) => {renderedMeshes.add(mesh.uuid);}};
  let loaded: ModelActor | undefined;
  let environment: ReturnType<typeof createModelEnvironment> | undefined;
  let disposed = false, lastTime = performance.now(), frame = 0;
  // Under the external clock the presentation time moves only by setFrame: a host on setPresentation leaves it 0.
  let appliedFrameSeconds = 0, localSeconds = 0;
  let display: ModelStageDisplay = 'model', materialMode: ModelStageMaterialMode = 'lit';
  const load = (declaration: ModelStageActor, signal: AbortSignal) =>
    loadModelStageAsset(declaration.asset.path, modelRuntimeAssetProfile(declaration.asset), signal);
  // A new actor joins at the stage's display and Surface choice, through the same owners as the character.
  const actors = createModelActorSet(source.id, load, (asset, declaration) => {
    const actor = createModelActor(asset, declaration, context);
    try {
      actor.rig.setDisplay(display);
      actor.materials.setMode(materialMode);
    } catch (error) {actor.dispose(); throw error;}
    return actor;
  });
  const current = () => {
    if (!loaded || disposed) throw new Error(MODEL_STAGE_TEXT.notReady);
    return loaded;
  };
  const everyActor = () => [current(), ...actors.actors];
  const apply = (value: unknown) => {
    if (policy.clock !== 'external') throw new ModelStageRefusal(MODEL_STAGE_TEXT.external);
    return applyModelFrame(everyActor(), value);
  };
  const presented = () => everyActor().flatMap(actor =>
    actor.presentation ? [{...actor.presentation, entityId: actor.id} satisfies ModelPreviewEntity] : []);
  const api: ModelStageController = {
    setAnimation(name) {
      current().playback.setAnimation(name);
      stage.requestFit();
    },
    setAnimationTime: value => current().playback.setAnimationTime(value),
    setPlaying: value => current().playback.setPlaying(value),
    setSkeleton: value => api.setDisplay(value ? 'both' : 'model'),
    setDisplay(value) {
      for (const actor of everyActor()) actor.rig.setDisplay(value);
      display = value;
      const entities = presented();
      if (entities.length) apply({simulationTimeSeconds: appliedFrameSeconds, entities});
      stage.requestFit();
    },
    setMaterialMode(value) {
      const all = everyActor();
      if (value !== 'lit' && all.some(actor => actor.presentation)) throw new ModelStageRefusal(MODEL_ACTOR_TEXT.unlit);
      const lacking = value === 'lit' ? undefined :
        all.find(actor => !actor.materials.snapshot().materialInspectionAvailable);
      if (lacking) throw new ModelStageRefusal(MODEL_STAGE_TEXT.inspection(lacking.id));
      for (const actor of all) actor.materials.setMode(value);
      materialMode = value;
    },
    setTransform: value => current().setPlacement(value),
    setPresentation(value) {
      apply({simulationTimeSeconds: appliedFrameSeconds, entities: [{...value, entityId: current().id}]});
    },
    setFrame(value) {appliedFrameSeconds = apply(value);},
    setActors(value) {
      if (current().driver === MODEL_STAGE_DRIVER.engine) {
        throw new ModelStageRefusal(MODEL_ACTOR_SET_TEXT.engineDriven(source.id));
      }
      return actors.replace(value);
    },
    setEnvironment(value) {
      if (disposed) throw new Error(MODEL_STAGE_TEXT.disposed);
      if (value !== null && environment?.update(value)) return;
      const next = value === null ? undefined : createModelEnvironment(value);
      environment?.dispose();
      environment = next;
      if (next) stage.scene.add(next.group);
    },
    setLighting(value) {
      if (disposed) throw new Error(MODEL_STAGE_TEXT.disposed);
      stage.lighting.set(value);
    },
    setCamera: stage.setCamera,
    resetCamera: stage.resetCamera,
    snapshot() {
      const model = current();
      const positions = model.markers.map(({key, bone}) => [key, bone.getWorldPosition(new THREE.Vector3()).toArray()]);
      const projections = model.markers.map(({key, bone}) =>
        [key, bone.getWorldPosition(new THREE.Vector3()).project(stage.camera).toArray()]);
      const poses: Record<string, THREE.QuaternionTuple> = {};
      model.asset.scene.traverse(node => {
        if (node instanceof THREE.Bone) poses[node.name] = node.quaternion.toArray();
      });
      const {animation, time, playing} = model.playback.review();
      return {
        id: source.id, animation, time, playing, ...model.rig.snapshot(), ...model.materials.snapshot(),
        lighting: stage.lighting.mode,
        attachmentPositions: Object.fromEntries(positions), attachmentProjections: Object.fromEntries(projections),
        poses, triangles: stage.renderer.info.render.triangles, renderedModelMeshes: renderedMeshes.size,
        canvas: {width: stage.renderer.domElement.width, height: stage.renderer.domElement.height},
        actors: everyActor().map(actor => actor.snapshot()), actorsPending: actors.pending,
      };
    },
  };
  const animate = (now: number) => {
    const delta = Math.min((now - lastTime) / settings.millisecondsPerSecond, settings.maxFrameDelta);
    lastTime = now;
    localSeconds += delta;
    // The one place this frame's presentation time is known; time-driven scenery reads it here.
    const presentationSeconds = policy.clock === 'external' ? appliedFrameSeconds : localSeconds;
    if (loaded) {
      for (const actor of everyActor()) {
        actor.playback.update(delta, !document.hidden);
        actor.placement.updateMatrixWorld(true);
        actor.rig.update();
      }
      stage.fit(loaded.placement, loaded.rig.display === 'model' ? undefined : loaded.rig.bounds());
    }
    if (stage.controls.enabled) stage.controls.update();
    stage.renderer.render(stage.scene, stage.camera);
    frame = requestAnimationFrame(animate);
  };
  // The character and the declared actors load together; one failure leaves the stage unusable and is reported once.
  const characterAsset = loadModelStageAsset(source.path, source.runtimeMaterials, request.signal);
  Promise.allSettled([characterAsset, actors.replace(declaredActors)]).then(([asset, declared]) => {
    if (asset.status === 'fulfilled' && (disposed || declared.status === 'rejected')) {
      disposeModelObject(asset.value.scene);
    }
    if (disposed) return;
    if (asset.status === 'rejected') throw asset.reason;
    if (declared.status === 'rejected') throw declared.reason;
    loaded = createModelActor(asset.value, {id: source.id, asset: source, placement: {}}, context);
    if (options.reviewKey) Object.defineProperty(host, options.reviewKey, {value: api, configurable: true});
    onReady(api);
  }).catch(error => {if (!disposed) onError(asError(error));});
  frame = requestAnimationFrame(animate);
  return () => {
    if (disposed) return;
    disposed = true;
    request.abort();
    cancelAnimationFrame(frame);
    actors.dispose();
    loaded?.dispose();
    environment?.dispose();
    stage.dispose();
    if (options.reviewKey && Reflect.get(host, options.reviewKey) === api) {
      Reflect.deleteProperty(host, options.reviewKey);
    }
  };
}
