import * as THREE from 'three';
import {REDUCED_MOTION_QUERY} from '../motion.ts';
import {modelLocalAdvance, modelLocalHold, modelStagePolicy} from './model.ts';
import type {ModelStageController, ModelStageHold, ModelStageOptions, ModelStageTheme} from './model.ts';
import {loadModelStageAsset} from './asset.ts';
import {createModelScene} from './scene.ts';
import {applyModelFrame, createModelActor, type ModelActor} from './actor.ts';
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
// Where each of the stage's times sits in its one typed array: the last applied frame's, the presentation time, and
// the wall clock at the last frame, in milliseconds.
const STAGE_TIME = Object.freeze({appliedFrame: 0, presentation: 1, lastFrame: 2});
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
  const context = {policy, theme, scene: stage.scene, lighting: stage.lighting, fog: stage.fog.change,
    rendered: (mesh: THREE.Mesh) => {renderedMeshes.add(mesh.uuid);}};
  const load = (declaration: ModelStageActor, signal: AbortSignal) =>
    loadModelStageAsset(declaration.asset.path, modelRuntimeAssetProfile(declaration), signal);
  const actors = createModelActorSet(load, (asset, declaration) => createModelActor(asset, declaration, context));
  const parts = createModelStageParts({...stage, kinds: policy.kinds});
  let applied: ModelStageDescription | undefined;
  let disposed = false, frame = 0;
  // The stage's one presentation time. Under the external clock only setFrame moves it; under the local clock the
  // elapsed time does, unless reduced motion or a hidden page holds it. Every clip on the local clock moves with it.
  // The times live in one typed array made here, so writing them every frame boxes no number.
  const times = new Float64Array(Object.keys(STAGE_TIME).length);
  times[STAGE_TIME.lastFrame] = performance.now();
  // Why the local clock holds, read from the page as it is now through one media query the stage keeps.
  const motion = window.matchMedia(REDUCED_MOTION_QUERY);
  const hold = () => modelLocalHold(motion.matches, document.hidden);
  // The actors the framing fits, taken when a description is shown, and the one box a due fit measures them into.
  let framed: readonly ModelActor[] = [];
  const fitted = new THREE.Box3();
  const measure = () => {
    fitted.makeEmpty();
    for (const actor of framed) fitted.union(actor.bounds());
    return fitted;
  };
  const live = () => {if (disposed) throw new Error(MODEL_STAGE_TEXT.disposed);};
  const current = () => {
    const focused = actors.focused;
    if (!applied || !focused || disposed) throw new Error(MODEL_STAGE_TEXT.notReady);
    return {applied, focused};
  };
  const setDescription = (value: unknown) => {
    live();
    const next = modelStageDescription(value);
    return actors.replace(next.actors, parts.loads(next), staged => {
      const changed = modelStageDescriptionChanges(applied, next), refit = modelStageRefit(applied, next);
      prepareWhole([staged.prepare, ...parts.prepares(next, changed, staged.actors)])();
      applied = next;
      const ids = new Set(modelStageFramed(next).map(({id}) => id));
      framed = staged.actors.filter(actor => ids.has(actor.id));
      if (refit) stage.requestFit();
    });
  };
  const api: ModelStageController = {
    setDescription,
    setFrame(value) {
      if (policy.clock !== 'external') throw new ModelStageRefusal(MODEL_STAGE_TEXT.external);
      times[STAGE_TIME.appliedFrame] = applyModelFrame(actors.actors, value);
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
      const held: ModelStageHold | null = policy.clock === 'external' ? null : hold();
      return {
        id: model.id, animation, time, playing, hold: held, ...model.rig.snapshot(), ...model.materials.snapshot(),
        lighting: stage.lighting.time,
        parts: points,
        poses, triangles: stage.triangles(), renderedModelMeshes: renderedMeshes.size,
        canvas: {width: stage.renderer.domElement.width, height: stage.renderer.domElement.height},
        actors: actors.actors.map(actor => actor.snapshot()), actorsPending: actors.pending,
      };
    },
  };
  // The frame loop makes no object, array or closure: every value it writes has a home made when the stage or a
  // description was. Numbers it hands to calls (the elapsed time, each playback's advance) can still be boxed by V8:
  // about 0.2 KB a frame, measured with one actor.
  const animate = (now: number) => {
    const previous = times[STAGE_TIME.presentation];
    times[STAGE_TIME.presentation] = policy.clock === 'external' ? times[STAGE_TIME.appliedFrame] :
      previous + modelLocalAdvance(now - times[STAGE_TIME.lastFrame], hold());
    times[STAGE_TIME.lastFrame] = now;
    const drawn = actors.actors;
    for (let index = 0; index < drawn.length; index++) {
      const actor = drawn[index];
      actor.playback.update(times[STAGE_TIME.presentation] - previous);
      actor.placement.updateMatrixWorld(true);
      actor.rig.update();
    }
    // Before the first description is shown there is nothing to frame; a held pose frames no actor.
    if (framed.length) stage.fit(measure);
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
