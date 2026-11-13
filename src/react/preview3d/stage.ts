import * as THREE from 'three';
import {reducedMotion} from '../motion.ts';
import {modelLocalAdvance, modelStagePolicy} from './model.ts';
import type {ModelStageController, ModelStageHold, ModelStageOptions, ModelStageTheme} from './model.ts';
import {loadModelStageAsset} from './asset.ts';
import {createModelScene} from './scene.ts';
import {applyModelFrame, createModelActor} from './actor.ts';
import {createModelActorSet} from './actorSet.ts';
import {modelRuntimeAssetProfile} from './actorModel.ts';
import type {ModelStageActor} from './actorModel.ts';
import {modelStageDescription, modelStageDescriptionChanges, modelStageFramed, modelStageRefit}
  from './descriptionModel.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import {createModelStageParts} from './stageParts.ts';
import {prepareWhole} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';

const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));
export const MODEL_STAGE_TEXT = Object.freeze({
  notReady: 'The preview model is not ready.', disposed: 'The preview has been disposed.',
  external: 'Runtime presentation requires an external clock.',
});

// The stage holds what one description declares and draws one engine frame over it. Creation applies the first
// description through the same function every later one uses.
export function createModelStage(
  host: HTMLElement, description: ModelStageDescription, theme: ModelStageTheme,
  onReady: (controller: ModelStageController) => void, onError: (error: Error) => void,
  options: ModelStageOptions,
): () => void {
  const policy = modelStagePolicy(options);
  const stage = createModelScene(host, theme, policy);
  const renderedMeshes = new Set<string>();
  const context = {policy, theme, scene: stage.scene, lighting: stage.lighting,
    rendered: (mesh: THREE.Mesh) => {renderedMeshes.add(mesh.uuid);}};
  const load = (declaration: ModelStageActor, signal: AbortSignal) =>
    loadModelStageAsset(declaration.asset.path, modelRuntimeAssetProfile(declaration), signal);
  const actors = createModelActorSet(load, (asset, declaration) => createModelActor(asset, declaration, context));
  const parts = createModelStageParts(stage);
  let applied: ModelStageDescription | undefined;
  let disposed = false, lastTime = performance.now(), frame = 0;
  // The stage's one presentation time. Under the external clock only setFrame moves it; under the local clock the
  // elapsed time does, unless reduced motion or a hidden page holds it. Every clip on the local clock moves with it.
  let appliedFrameSeconds = 0, presentationSeconds = 0;
  // The local clock over this much elapsed time, and why it holds, read from the page as it is now.
  const local = (elapsedMilliseconds: number) =>
    modelLocalAdvance(elapsedMilliseconds, {reducedMotion: reducedMotion(), hidden: document.hidden});
  const live = () => {if (disposed) throw new Error(MODEL_STAGE_TEXT.disposed);};
  const current = () => {
    const focused = actors.focused;
    if (!applied || !focused || disposed) throw new Error(MODEL_STAGE_TEXT.notReady);
    return {applied, focused};
  };
  const setDescription = (value: unknown) => {
    live();
    const next = modelStageDescription(value);
    return actors.replace(next.actors, staged => {
      const changed = modelStageDescriptionChanges(applied, next), refit = modelStageRefit(applied, next);
      prepareWhole([staged.prepare, ...parts.prepares(next, changed, staged.actors)])();
      applied = next;
      if (refit) stage.requestFit();
    });
  };
  const api: ModelStageController = {
    setDescription,
    setFrame(value) {
      if (policy.clock !== 'external') throw new ModelStageRefusal(MODEL_STAGE_TEXT.external);
      appliedFrameSeconds = applyModelFrame(actors.actors, value);
    },
    resetCamera: () => parts.resetCamera(current().applied),
    snapshot() {
      const {focused: model} = current();
      const points = model.points.map(({name, node}) => Object.freeze({name,
        position: node.getWorldPosition(new THREE.Vector3()).toArray(),
        rotationQuaternion: node.getWorldQuaternion(new THREE.Quaternion()).toArray()}));
      const poses: Record<string, THREE.QuaternionTuple> = {};
      model.asset.scene.traverse(node => {
        if (node instanceof THREE.Bone) poses[node.name] = node.quaternion.toArray();
      });
      const {animation, time, playing} = model.playback.review();
      const hold: ModelStageHold | null = policy.clock === 'external' ? null : local(0).hold;
      return {
        id: model.id, animation, time, playing, hold, ...model.rig.snapshot(), ...model.materials.snapshot(),
        lighting: stage.lighting.time,
        parts: points,
        poses, triangles: stage.renderer.info.render.triangles, renderedModelMeshes: renderedMeshes.size,
        canvas: {width: stage.renderer.domElement.width, height: stage.renderer.domElement.height},
        actors: actors.actors.map(actor => actor.snapshot()), actorsPending: actors.pending,
      };
    },
  };
  const animate = (now: number) => {
    const previous = presentationSeconds;
    presentationSeconds = policy.clock === 'external' ? appliedFrameSeconds :
      presentationSeconds + local(now - lastTime).seconds;
    lastTime = now;
    for (const actor of actors.actors) {
      actor.playback.update(presentationSeconds - previous);
      actor.placement.updateMatrixWorld(true);
      actor.rig.update();
    }
    // Before the first description is shown there is nothing to frame; a held pose frames no actor.
    // The drawn actors are the applied description's, swapped in by the same commit.
    const ids = new Set(applied ? modelStageFramed(applied).map(({id}) => id) : []);
    const framed = actors.actors.filter(actor => ids.has(actor.id));
    if (framed.length) {
      stage.fit(() => framed.reduce((bounds, actor) => bounds.union(actor.bounds()), new THREE.Box3()));
    }
    if (stage.controls.enabled) stage.controls.update();
    stage.draw();
    frame = requestAnimationFrame(animate);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    actors.dispose();
    parts.dispose();
    stage.dispose();
    if (Reflect.get(host, options.reviewKey) === api) {
      Reflect.deleteProperty(host, options.reviewKey);
    }
  };
  let first: Promise<void>;
  // An invalid first description leaves nothing behind: what was built is released and the refusal goes on.
  try {first = setDescription(description);} catch (error) {dispose(); throw error;}
  first.then(() => {
    if (disposed) return;
    Object.defineProperty(host, options.reviewKey, {value: api, configurable: true});
    onReady(api);
  }, (error: unknown) => {if (!disposed) onError(asError(error));});
  frame = requestAnimationFrame(animate);
  return dispose;
}
