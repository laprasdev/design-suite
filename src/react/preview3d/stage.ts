import * as THREE from 'three';
import {REDUCED_MOTION_QUERY} from '../motion.ts';
import {modelLocalAdvance, modelLocalHold, modelStagePolicy} from './model.ts';
import type {ModelStageController, ModelStageHold, ModelStageOptions, ModelStageTheme} from './model.ts';
import {MODEL_STAGE_CLOCK} from './stageOptionsModel.ts';
import {loadModelStageAsset, modelDrawnMeshCount} from './asset.ts';
import {createModelScene} from './scene.ts';
import {applyModelFrame} from './actor.ts';
import type {ModelStageDescription} from './descriptionModel.ts';
import {createModelSurfaceModes} from './materials.ts';
import {decodeModelImage} from './textures.ts';
import {readModelFile} from './files.ts';
import {modelSurfaceDrawable} from './surfaceProgram.ts';
import {createModelStageDescriptions} from './stageDescriptions.ts';
import {createModelFrameLoop, MODEL_PAGE_FRAMES} from './frameLoop.ts';
import {ModelStageRefusal} from './refusal.ts';

const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));
// Where each of the stage's times sits in its one typed array: the last applied frame's, the presentation time, the
// wall clock at the last frame, in milliseconds, and, under the external clock, the kinds' decorative time.
const STAGE_TIME = Object.freeze({appliedFrame: 0, presentation: 1, lastFrame: 2, decorative: 3});
export const MODEL_STAGE_TEXT = Object.freeze({
  notReady: 'The preview model is not ready.', disposed: 'The preview has been disposed.',
  external: 'Runtime presentation requires an external clock.',
});

// The stage holds what one description declares and draws one engine frame over it. Creation applies the first
// description through the same function every later one uses. A failure nothing could refuse ahead (a frame that
// throws, or the first description failing) reaches `onError`; the stage then draws nothing more.
export function createModelStage(
  host: HTMLElement, description: ModelStageDescription, theme: ModelStageTheme,
  onReady: (controller: ModelStageController) => void, onError: (error: Error) => void,
  options: ModelStageOptions,
): () => void {
  const policy = modelStagePolicy(options);
  // A kind this stage cannot draw is refused before anything is built, so it leaves no canvas behind.
  for (const kind of policy.kinds.values()) modelSurfaceDrawable(kind);
  const modes = createModelSurfaceModes();
  const stage = createModelScene(host, theme, policy, () => modes.inspecting);
  const descriptions = createModelStageDescriptions({policy, theme, stage, modes, load: loadModelStageAsset,
    read: readModelFile, decode: decodeModelImage});
  const {actors} = descriptions;
  let disposed = false;
  // The stage's one presentation time. Under the external clock only setFrame moves it; under the local clock the
  // elapsed time does, unless reduced motion or a hidden page holds it. Every clip on the local clock moves with it.
  // The times live in one typed array made here, so writing them every frame boxes no number.
  const times = new Float64Array(Object.keys(STAGE_TIME).length);
  times[STAGE_TIME.lastFrame] = performance.now();
  // Why the local clock holds, read from the page as it is now through one media query the stage keeps.
  const motion = window.matchMedia(REDUCED_MOTION_QUERY);
  const hold = () => modelLocalHold(motion.matches, document.hidden);
  // The one box a due fit measures the framed actors into.
  const fitted = new THREE.Box3();
  const measure = () => {
    fitted.makeEmpty();
    for (const actor of descriptions.framed) fitted.union(actor.bounds());
    return fitted;
  };
  const live = () => {if (disposed) throw new Error(MODEL_STAGE_TEXT.disposed);};
  const current = () => {
    const focused = actors.focused, {applied} = descriptions;
    if (!applied || !focused || disposed) throw new Error(MODEL_STAGE_TEXT.notReady);
    return {applied, focused};
  };
  const setDescription = (value: unknown) => {
    live();
    return descriptions.set(value);
  };
  const external = policy.clock === MODEL_STAGE_CLOCK.external;
  const api: ModelStageController = {
    setDescription,
    setFrame(value) {
      if (!external) throw new ModelStageRefusal(MODEL_STAGE_TEXT.external);
      times[STAGE_TIME.appliedFrame] = applyModelFrame(actors.actors, descriptions.scope, value);
    },
    resetCamera: () => descriptions.parts.resetCamera(current().applied),
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
      const held: ModelStageHold | null = external ? null : hold();
      return {
        id: model.id, animation, time, playing, hold: held, ...model.rig.snapshot(),
        surfaceMode: modes.mode, surfaceModesAvailable: model.materials.available,
        emissiveMaterialCount: model.materials.emissiveMaterialCount,
        lighting: stage.lighting.time,
        parts: points, poses, triangles: stage.triangles(),
        renderedModelMeshes: modelDrawnMeshCount(actors.actors.map(actor => actor.asset.scene), stage.camera),
        canvas: {width: stage.renderer.domElement.width, height: stage.renderer.domElement.height},
        actors: actors.actors.map(actor => actor.snapshot()), actorsPending: actors.pending,
      };
    },
  };
  // A frame makes no object, array or closure: every value it writes has a home made when the stage or a description
  // was. The kinds' decorative time moves by the page's clock and holds as the local clock does, on either clock. Under
  // the local clock that is the presentation time itself; under the external one it is kept on its own. It is written
  // into the shared numbers once a frame, typed array to typed array (each double the loop computes costs a boxed
  // number while the loop runs unoptimised, measured: harness/measure.mjs).
  const {numbers: shared, secondsAt} = stage.shared;
  const decorative = external ? STAGE_TIME.decorative : STAGE_TIME.presentation;
  const animate = (now: number) => {
    const previous = times[STAGE_TIME.presentation];
    if (external) {
      times[STAGE_TIME.presentation] = times[STAGE_TIME.appliedFrame];
      times[STAGE_TIME.decorative] += modelLocalAdvance(now - times[STAGE_TIME.lastFrame], hold());
    } else times[STAGE_TIME.presentation] = previous + modelLocalAdvance(now - times[STAGE_TIME.lastFrame], hold());
    shared[secondsAt] = times[decorative];
    times[STAGE_TIME.lastFrame] = now;
    const drawn = actors.actors;
    for (let index = 0; index < drawn.length; index++) {
      const actor = drawn[index];
      actor.playback.update(times[STAGE_TIME.presentation] - previous);
      actor.placement.updateMatrixWorld(true);
      actor.rig.update();
    }
    // Before the first description is shown there is nothing to frame; a held pose frames no actor.
    if (descriptions.framed.length) stage.fit(measure);
    if (stage.controls.enabled) stage.controls.update();
    stage.draw();
  };
  const fail = (error: unknown) => {if (!disposed) onError(asError(error));};
  const loop = createModelFrameLoop(animate, fail, MODEL_PAGE_FRAMES);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loop.stop();
    descriptions.dispose();
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
  }, fail);
  loop.start();
  return dispose;
}
