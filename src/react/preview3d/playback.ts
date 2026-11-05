import * as THREE from 'three';
import {MODEL_REST_POSE} from './model.ts';
import type {ModelStageClock} from './model.ts';

// One bound clip. Runtime layer/blend evaluation and loop resolution stay with the caller.
export function createModelPlayback(root: THREE.Object3D, clips: readonly THREE.AnimationClip[],
  clock: ModelStageClock = 'local') {
  const mixer = new THREE.AnimationMixer(root);
  let action: THREE.AnimationAction | undefined;
  let playing = false;
  return {
    setAnimation(name: string) {
      const clip = name === MODEL_REST_POSE ? undefined : clips.find(candidate => candidate.name === name);
      if (name !== MODEL_REST_POSE && !clip) throw new Error(`Missing animation: ${name}`);
      if (clock === 'external' && clip && (!Number.isFinite(clip.duration) || clip.duration < 0)) {
        throw new Error('An externally sampled clip must have a finite, nonnegative duration.');
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
      if (clock !== 'external') throw new Error('Clip time is controlled by the local preview clock.');
      if (!action) throw new Error('Select an animation before sampling its clip time.');
      const duration = action.getClip().duration;
      if (!Number.isFinite(timeSeconds) || timeSeconds < 0 || timeSeconds > duration) {
        throw new Error(`Clip time must be finite and within [0, ${duration}] seconds.`);
      }
      // A zero-delta evaluation samples this inclusive endpoint without loop wrapping or advancing mixer time.
      action.time = timeSeconds;
      mixer.update(0);
    },
    setPlaying(value: boolean) {
      if (clock === 'external' && value) throw new Error('An external clock cannot enable local playback.');
      playing = value;
    },
    update(deltaSeconds: number, visible: boolean) {
      if (clock === 'local') mixer.update(playing && visible ? deltaSeconds : 0);
    },
    snapshot() {
      return {animation: action?.getClip().name ?? MODEL_REST_POSE, time: action?.time ?? 0,
        playing: clock === 'local' && playing};
    },
    dispose() {mixer.stopAllAction(); mixer.uncacheRoot(root);},
  };
}
