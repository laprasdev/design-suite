import * as THREE from 'three';
import {MODEL_ANIMATION_SAMPLES, MODEL_REST_POSE} from './model.ts';
import type {ModelStageClock} from './model.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelAnimationLayer, ModelAnimationSample} from './animationLayerModel.ts';
import {MODEL_ACTOR_ANIMATION, type ModelStageActorAnimation} from './actorModel.ts';
import type {ModelStageCommit} from './commit.ts';

// `applied` is the count of the commit that last applied it, so a commit retires what it did not apply.
interface SampleAction {clipId: string; clip: THREE.AnimationClip; action: THREE.AnimationAction; applied: number}
const createSampleSlots = () => ({samples: new Array<ModelAnimationSample>(), clips: new Array<THREE.AnimationClip>(),
  weights: new Array<number>(), count: 0});
export const MODEL_PLAYBACK_REFUSAL = Object.freeze({
  local: 'Engine animation layers require an external clock.',
  layered: 'Engine animation layers drive this model; the host selection is held.',
  external: (owner: string) => `Actor ${owner}: an external clock cannot play on the local clock.`,
  missing: (owner: string, clipId: string) => `Actor ${owner}: clip ${clipId} is not an animation in the model file.`,
  duration: (owner: string, clipId: string) => `Actor ${owner}: clip ${clipId} has no finite, nonnegative duration.`,
  time: (owner: string, clipId: string, time: number, duration: number) =>
    `Actor ${owner}: clip ${clipId} time ${time} lies outside [0, ${duration}] seconds.`,
});
const refusal = MODEL_PLAYBACK_REFUSAL;

// One host-selected clip, plus the engine's samples once layers apply. Layer evaluation stays with the engine.
export function createModelPlayback(root: THREE.Object3D, clips: readonly THREE.AnimationClip[],
  clock: ModelStageClock, owner: string) {
  const mixer = new THREE.AnimationMixer(root);
  let action: THREE.AnimationAction | undefined;
  let playing = false, layered = false;
  let samples = new Map<string, SampleAction>();
  const resolve = (clipId: string) => {
    const clip = clips.find(candidate => candidate.name === clipId);
    if (!clip) throw new ModelStageRefusal(refusal.missing(owner, clipId));
    return clip;
  };
  // A clip sampled at a stated time: its duration must be finite and the time within it.
  const sampled = (clipId: string, time: number) => {
    const clip = resolve(clipId);
    if (!Number.isFinite(clip.duration) || clip.duration < 0) {
      throw new ModelStageRefusal(refusal.duration(owner, clipId));
    }
    if (time > clip.duration) throw new ModelStageRefusal(refusal.time(owner, clipId, time, clip.duration));
    return clip;
  };
  // The rest pose binds no clip; a clip already bound keeps its action and its time.
  const rest = () => {mixer.stopAllAction(); action = undefined; mixer.update(0);};
  const keep = (clip: THREE.AnimationClip) => {
    if (clip === action?.getClip()) return action;
    mixer.stopAllAction();
    const bound = mixer.clipAction(clip).reset().play();
    bound.paused = clock === 'external';
    action = bound;
    mixer.update(0);
    return bound;
  };
  const retire = (entry: SampleAction) => {entry.action.stop(); mixer.uncacheClip(entry.clip);};
  const sampleAction = (sampleId: string, clipId: string, clip: THREE.AnimationClip): SampleAction => {
    const kept = samples.get(sampleId);
    if (kept?.clipId === clipId) return kept;
    const copy = clip.clone(), next = mixer.clipAction(copy);
    next.play();
    next.paused = true;
    return {clipId, clip: copy, action: next, applied: commits};
  };
  // A frame's samples, in the order its layers state them, each with its clip and its weight times its layer's: the
  // pending slots a prepare writes and the applied ones the commit made here swaps them into, so a frame tick makes
  // nothing (the slots grow only to the most samples a frame has stated). The sample actions are kept in place: a
  // sample a commit does not apply is retired, never by rebuilding the map (V8's `clear` makes a new table).
  let pending = createSampleSlots(), applied = createSampleSlots(), commits = 0;
  const retireUnapplied = (entry: SampleAction, id: string) => {
    if (entry.applied === commits) return;
    retire(entry);
    samples.delete(id);
  };
  const commitLayers: ModelStageCommit = () => {
    commits++;
    for (let index = 0; index < pending.count; index++) {
      const sample = pending.samples[index], kept = samples.get(sample.sampleId);
      const entry = sampleAction(sample.sampleId, sample.clipId, pending.clips[index]);
      if (kept !== undefined && kept !== entry) retire(kept);
      entry.action.time = sample.timeSeconds;
      entry.action.weight = pending.weights[index];
      entry.applied = commits;
      samples.set(sample.sampleId, entry);
    }
    samples.forEach(retireUnapplied);
    const written = applied;
    applied = pending;
    pending = written;
    layered = true;
    // With no samples the host selection stands: the held clip, or the rest pose.
    if (action) action.enabled = samples.size === 0;
    mixer.update(0);
  };
  const snapshot = () => ({animation: action?.getClip().name ?? MODEL_REST_POSE, time: action?.time ?? 0,
    playing: clock === 'local' && playing});
  return {
    // The actor's host animation, applied as a change: a clip already bound keeps its time unless it is held at one.
    prepareAnimation(value: ModelStageActorAnimation): ModelStageCommit {
      if (layered) throw new ModelStageRefusal(refusal.layered);
      if (value.kind === MODEL_ACTOR_ANIMATION.rest) return () => {rest(); playing = false;};
      if (value.kind === MODEL_ACTOR_ANIMATION.playing) {
        if (clock === 'external') throw new ModelStageRefusal(refusal.external(owner));
        const clip = resolve(value.name);
        return () => {keep(clip); playing = true;};
      }
      const clip = sampled(value.name, value.timeSeconds), time = value.timeSeconds;
      return () => {
        // A zero-delta evaluation samples this inclusive endpoint without loop wrapping or advancing mixer time.
        keep(clip).time = time;
        mixer.update(0);
        playing = false;
      };
    },
    // Check every clip and time first; the returned commit sets each sample and evaluates once, never advancing.
    prepareLayers(layers: readonly ModelAnimationLayer[]): ModelStageCommit {
      if (clock !== 'external') throw new ModelStageRefusal(refusal.local);
      let count = 0;
      for (let layer = 0; layer < layers.length; layer++) {
        const stated = layers[layer].samples, weight = layers[layer].weight;
        for (let index = 0; index < stated.length; index++, count++) {
          pending.clips[count] = sampled(stated[index].clipId, stated[index].timeSeconds);
          pending.samples[count] = stated[index];
          pending.weights[count] = stated[index].weight * weight;
        }
      }
      pending.count = count;
      return commitLayers;
    },
    // The stage's presentation time moved by this much; only a playing clip, which the local clock alone allows,
    // moves with it.
    update(advanceSeconds: number) {
      if (playing) mixer.update(advanceSeconds);
    },
    snapshot,
    // While samples play no single clip or time describes the pose; the applied samples do.
    review() {
      const reviewed = Object.freeze(Array.from({length: applied.count}, (_, index) =>
        Object.freeze({...applied.samples[index], weight: applied.weights[index]})));
      return reviewed.length ? {...snapshot(), animation: MODEL_ANIMATION_SAMPLES, time: null, samples: reviewed}
        : {...snapshot(), samples: reviewed};
    },
    dispose() {mixer.stopAllAction(); mixer.uncacheRoot(root);},
  };
}
