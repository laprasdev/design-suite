import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelPlayback} from '../src/react/preview3d/playback.ts';
import {MODEL_REST_POSE, modelStagePolicy, type ModelStageClock} from '../src/react/preview3d/model.ts';

function fixture(clock: ModelStageClock = 'local') {
  const root = new THREE.Group(), bone = new THREE.Bone();
  bone.name = 'tip';
  bone.position.set(2, 3, 4);
  root.add(bone);
  const clip = new THREE.AnimationClip('motion', 2, [
    new THREE.VectorKeyframeTrack('tip.position', [0, 1, 2], [0, 0, 0, 4, 0, 0, 10, 0, 0]),
    new THREE.QuaternionKeyframeTrack('tip.quaternion', [0, 2], [0, 0, 0, 1, 0, 1, 0, 0]),
  ]);
  const invalid = new THREE.AnimationClip('invalid', 1, []);
  invalid.duration = Infinity;
  const playback = createModelPlayback(root, [clip, invalid], clock);
  const evidence = () => ({...playback.snapshot(),
    position: bone.position.toArray(), rotation: bone.quaternion.toArray()});
  return {root, bone, playback, evidence};
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7);

describe('model clip clock ownership', () => {
  it('samples an inclusive endpoint, repeats it and seeks backward without loop wrapping', () => {
    const {bone, playback, evidence} = fixture('external');
    playback.setAnimation('motion');
    playback.setAnimationTime(2);
    assert.deepEqual(playback.snapshot(), {animation: 'motion', time: 2, playing: false});
    assert.deepEqual(bone.position.toArray(), [10, 0, 0]);
    assert.deepEqual(bone.quaternion.toArray(), [0, 1, 0, 0]);
    const endpoint = evidence();
    playback.setAnimationTime(2);
    assert.deepEqual(evidence(), endpoint);
    playback.setAnimationTime(0.25);
    assert.equal(bone.position.x, 1);
    assert.equal(playback.snapshot().time, 0.25);
    playback.setAnimationTime(0);
    assert.deepEqual(bone.position.toArray(), [0, 0, 0]);
    assert.deepEqual(bone.quaternion.toArray(), [0, 0, 0, 1]);
    playback.dispose();
  });

  it('rejects invalid times and invalid bindings without changing the sampled time or pose', () => {
    const {playback, evidence} = fixture('external');
    playback.setAnimation('motion');
    playback.setAnimationTime(1.25);
    const before = evidence();
    for (const time of [NaN, Infinity, -Infinity, -0.001, 2.001]) {
      assert.throws(() => playback.setAnimationTime(time), /finite and within/);
      assert.deepEqual(evidence(), before);
    }
    assert.throws(() => playback.setAnimation('missing'), /Missing animation/);
    assert.deepEqual(evidence(), before);
    assert.throws(() => playback.setAnimation('invalid'), /finite, nonnegative duration/);
    assert.deepEqual(evidence(), before);
    playback.dispose();
  });

  it('never advances from render/focus updates and refuses local playback in external mode', () => {
    const {playback, evidence} = fixture('external');
    playback.setAnimation('motion');
    playback.setAnimationTime(0.75);
    const before = evidence();
    assert.throws(() => playback.setPlaying(true), /external clock/);
    playback.setPlaying(false);
    for (const visible of [true, false, true]) {
      for (const delta of [0, 0.016, 1, 600]) playback.update(delta, visible);
      assert.deepEqual(evidence(), before);
    }
    assert.equal(playback.snapshot().playing, false);
    playback.dispose();
  });

  it('keeps local diagnostic playback, pause, hidden-tab behavior and looping isolated', () => {
    const {bone, playback, evidence} = fixture();
    playback.setAnimation('motion');
    playback.setPlaying(true);
    playback.update(0.4, true);
    close(bone.position.x, 1.6);
    const before = evidence();
    assert.throws(() => playback.setAnimationTime(1), /local preview clock/);
    assert.deepEqual(evidence(), before);
    playback.update(60, false);
    assert.deepEqual(evidence(), before);
    playback.setPlaying(false);
    playback.update(60, true);
    close(playback.snapshot().time, 0.4);
    close(bone.position.x, 1.6);
    playback.setPlaying(true);
    playback.update(1.9, true);
    close(playback.snapshot().time, 0.3);
    close(bone.position.x, 1.2);
    playback.dispose();
  });

  it('requires a bound clip and restores the authored rest pose without inventing a sample', () => {
    const {bone, playback, evidence} = fixture('external');
    assert.throws(() => playback.setAnimationTime(0), /Select an animation/);
    playback.setAnimation('motion');
    playback.setAnimationTime(1);
    playback.setAnimation(MODEL_REST_POSE);
    assert.deepEqual(bone.position.toArray(), [2, 3, 4]);
    const rest = evidence();
    assert.throws(() => playback.setAnimationTime(0), /Select an animation/);
    assert.deepEqual(evidence(), rest);
    playback.dispose();
  });

  it('supports the sole endpoint of a zero-duration clip', () => {
    const root = new THREE.Group();
    const clip = new THREE.AnimationClip('still', 0, [new THREE.VectorKeyframeTrack('.position', [0], [3, 2, 1])]);
    const playback = createModelPlayback(root, [clip], 'external');
    playback.setAnimation('still');
    playback.setAnimationTime(0);
    assert.deepEqual(root.position.toArray(), [3, 2, 1]);
    assert.equal(playback.snapshot().time, 0);
    assert.throws(() => playback.setAnimationTime(Number.EPSILON), /finite and within/);
    playback.dispose();
  });

  it('defaults the stage policy to local and accepts only the declared clock owners', () => {
    assert.equal(modelStagePolicy().clock, 'local');
    assert.equal(modelStagePolicy({clock: 'external'}).clock, 'external');
    assert.throws(() => modelStagePolicy({clock: 'unknown' as ModelStageClock}), /local or external/);
  });
});
