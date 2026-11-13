import * as THREE from 'three';
import {MODEL_ANIMATION_SAMPLES, MODEL_REST_POSE} from './model.ts';
import type {ModelStageClock} from './model.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelAnimationLayer, ModelAnimationSample} from './animationLayerModel.ts';
import type {ModelStageActorAnimation} from './actorModel.ts';
import type {ModelStageCommit} from './commit.ts';

interface SampleAction {clipId: string; clip: THREE.AnimationClip; action: THREE.AnimationAction}
export const MODEL_PLAYBACK_REFUSAL = Object.freeze({
  local: 'Engine animation layers require an external clock.',
  layered: 'Engine animation layers drive this model; the host selection is held.',
  external: (owner: string) => `Actor ${owner}: an external clock cannot play on the local clock.`,
  rest: (owner: string) => `Actor ${owner}: the rest pose neither plays nor holds a time.`,
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
  let samples = new Map<string, SampleAction>(), applied: readonly ModelAnimationSample[] = Object.freeze([]);
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
  const bind = (clip: THREE.AnimationClip | undefined) => {
    mixer.stopAllAction();
    action = clip && mixer.clipAction(clip);
    action?.reset().play();
    if (action) action.paused = clock === 'external';
    mixer.update(0);
    return action;
  };
  const retire = (entry: SampleAction) => {entry.action.stop(); mixer.uncacheClip(entry.clip);};
  const sampleAction = (sampleId: string, clipId: string, clip: THREE.AnimationClip): SampleAction => {
    const kept = samples.get(sampleId);
    if (kept?.clipId === clipId) return kept;
    const copy = clip.clone(), next = mixer.clipAction(copy);
    next.play();
    next.paused = true;
    return {clipId, clip: copy, action: next};
  };
  const snapshot = () => ({animation: action?.getClip().name ?? MODEL_REST_POSE, time: action?.time ?? 0,
    playing: clock === 'local' && playing});
  return {
    // The actor's host animation, applied as a change: the clip already bound keeps its time unless one is held.
    prepareAnimation(value: ModelStageActorAnimation): ModelStageCommit {
      if (layered) throw new ModelStageRefusal(refusal.layered);
      const {name, playing: plays, timeSeconds} = value;
      if (name === MODEL_REST_POSE && (plays || timeSeconds !== undefined)) {
        throw new ModelStageRefusal(refusal.rest(owner));
      }
      if (plays && clock === 'external') throw new ModelStageRefusal(refusal.external(owner));
      const held = clock === 'external' || timeSeconds !== undefined;
      const clip = name === MODEL_REST_POSE ? undefined : held ? sampled(name, timeSeconds ?? 0) : resolve(name);
      return () => {
        const bound = clip === action?.getClip() ? action : bind(clip);
        if (bound && timeSeconds !== undefined) {
          // A zero-delta evaluation samples this inclusive endpoint without loop wrapping or advancing mixer time.
          bound.time = timeSeconds;
          mixer.update(0);
        }
        playing = plays;
      };
    },
    // Check every clip and time first; the returned commit sets each sample and evaluates once, never advancing.
    prepareLayers(layers: readonly ModelAnimationLayer[]): ModelStageCommit {
      if (clock !== 'external') throw new ModelStageRefusal(refusal.local);
      const planned = layers.flatMap(layer => layer.samples.map(sample => ({clip: sampled(sample.clipId,
        sample.timeSeconds), sample: Object.freeze({...sample, weight: sample.weight * layer.weight})})));
      return () => {
        const next = new Map<string, SampleAction>();
        for (const {clip, sample} of planned) {
          const entry = sampleAction(sample.sampleId, sample.clipId, clip);
          entry.action.time = sample.timeSeconds;
          entry.action.weight = sample.weight;
          next.set(sample.sampleId, entry);
        }
        for (const [id, entry] of samples) if (next.get(id) !== entry) retire(entry);
        samples = next;
        applied = Object.freeze(planned.map(({sample}) => sample));
        layered = true;
        // With no samples the host selection stands: the held clip, or the rest pose.
        if (action) action.enabled = next.size === 0;
        mixer.update(0);
      };
    },
    update(deltaSeconds: number, visible: boolean) {
      if (clock === 'local') mixer.update(playing && visible ? deltaSeconds : 0);
    },
    snapshot,
    // While samples play no single clip or time describes the pose; the applied samples do.
    review() {
      return applied.length ? {...snapshot(), animation: MODEL_ANIMATION_SAMPLES, time: null, samples: applied}
        : {...snapshot(), samples: applied};
    },
    dispose() {mixer.stopAllAction(); mixer.uncacheRoot(root);},
  };
}
