import * as THREE from 'three';
import {MODEL_ANIMATION_SAMPLES, MODEL_REST_POSE} from './model.ts';
import type {ModelStageClock} from './model.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelAnimationLayer, ModelAnimationSample} from './animationLayerModel.ts';

interface SampleAction {clipId: string; clip: THREE.AnimationClip; action: THREE.AnimationAction}
export const MODEL_PLAYBACK_REFUSAL = Object.freeze({
  unowned: 'Engine clips require the actor that owns them.',
  local: 'Engine animation layers require an external clock.',
  layered: 'Engine animation layers drive this model; the host selection is held.',
  missing: (owner: string, clipId: string) => `Actor ${owner}: clip ${clipId} is not an animation in the model file.`,
  duration: (owner: string, clipId: string) => `Actor ${owner}: clip ${clipId} has no finite, nonnegative duration.`,
  time: (owner: string, clipId: string, time: number, duration: number) =>
    `Actor ${owner}: clip ${clipId} time ${time} lies outside [0, ${duration}] seconds.`,
});
const refusal = MODEL_PLAYBACK_REFUSAL;

// One host-selected clip, plus the engine's samples once layers apply. Layer evaluation stays with the engine.
export function createModelPlayback(root: THREE.Object3D, clips: readonly THREE.AnimationClip[],
  clock: ModelStageClock = 'local', owner?: string) {
  const mixer = new THREE.AnimationMixer(root);
  let action: THREE.AnimationAction | undefined;
  let playing = false, layered = false;
  let samples = new Map<string, SampleAction>(), applied: readonly ModelAnimationSample[] = Object.freeze([]);
  // The actor whose clips these are, named in every engine-clip refusal.
  const actor = () => {
    if (owner === undefined) throw new Error(refusal.unowned);
    return owner;
  };
  const resolve = (clipId: string) => {
    const clip = clips.find(candidate => candidate.name === clipId);
    if (!clip) throw new ModelStageRefusal(refusal.missing(actor(), clipId));
    return clip;
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
    resolve,
    setAnimation(name: string) {
      if (layered) throw new ModelStageRefusal(refusal.layered);
      const clip = name === MODEL_REST_POSE ? undefined : clips.find(candidate => candidate.name === name);
      if (name !== MODEL_REST_POSE && !clip) throw new ModelStageRefusal(`Missing animation: ${name}`);
      if (clock === 'external' && clip && (!Number.isFinite(clip.duration) || clip.duration < 0)) {
        throw new ModelStageRefusal('An externally sampled clip must have a finite, nonnegative duration.');
      }
      mixer.stopAllAction();
      action = undefined;
      if (!clip) return;
      action = mixer.clipAction(clip);
      action.reset().play();
      action.paused = clock === 'external';
      mixer.update(0);
    },
    setAnimationTime(timeSeconds: number) {
      if (clock !== 'external') throw new ModelStageRefusal('Clip time is controlled by the local preview clock.');
      if (layered) throw new ModelStageRefusal(refusal.layered);
      if (!action) throw new ModelStageRefusal('Select an animation before sampling its clip time.');
      const duration = action.getClip().duration;
      if (!Number.isFinite(timeSeconds) || timeSeconds < 0 || timeSeconds > duration) {
        throw new ModelStageRefusal(`Clip time must be finite and within [0, ${duration}] seconds.`);
      }
      // A zero-delta evaluation samples this inclusive endpoint without loop wrapping or advancing mixer time.
      action.time = timeSeconds;
      mixer.update(0);
    },
    // Check every clip and time first; the returned commit sets each sample and evaluates once, never advancing.
    prepareLayers(layers: readonly ModelAnimationLayer[]) {
      if (clock !== 'external') throw new ModelStageRefusal(refusal.local);
      const planned = layers.flatMap(layer => layer.samples.map(sample => {
        const clip = resolve(sample.clipId);
        if (!Number.isFinite(clip.duration) || clip.duration < 0) {
          throw new ModelStageRefusal(refusal.duration(actor(), sample.clipId));
        }
        if (sample.timeSeconds > clip.duration) {
          throw new ModelStageRefusal(refusal.time(actor(), sample.clipId, sample.timeSeconds, clip.duration));
        }
        return {clip, sample: Object.freeze({...sample, weight: sample.weight * layer.weight})};
      }));
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
    setPlaying(value: boolean) {
      if (clock === 'external' && value) throw new ModelStageRefusal('An external clock cannot enable local playback.');
      playing = value;
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
