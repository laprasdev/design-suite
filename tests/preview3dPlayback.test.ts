import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelPlayback} from '../src/react/preview3d/playback.ts';
import {MODEL_REST_POSE, modelStagePolicy, type ModelStageClock} from '../src/react/preview3d/model.ts';
import type {ModelStageActorAnimation} from '../src/react/preview3d/model.ts';

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
  const playback = createModelPlayback(root, [clip, invalid], clock, 'p1');
  const apply = (value: ModelStageActorAnimation) => playback.prepareAnimation(value)();
  const evidence = () => ({...playback.snapshot(),
    position: bone.position.toArray(), rotation: bone.quaternion.toArray()});
  return {root, bone, playback, apply, evidence};
}
const held = (timeSeconds: number, name = 'motion') => ({name, playing: false, timeSeconds});
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7);

describe('an actor\'s host animation', () => {
  it('samples an inclusive endpoint, repeats it and seeks backward without loop wrapping', () => {
    const {bone, playback, apply, evidence} = fixture('external');
    apply(held(2));
    assert.deepEqual(playback.snapshot(), {animation: 'motion', time: 2, playing: false});
    assert.deepEqual(bone.position.toArray(), [10, 0, 0]);
    assert.deepEqual(bone.quaternion.toArray(), [0, 1, 0, 0]);
    const endpoint = evidence();
    apply(held(2));
    assert.deepEqual(evidence(), endpoint);
    apply(held(0.25));
    assert.equal(bone.position.x, 1);
    assert.equal(playback.snapshot().time, 0.25);
    apply(held(0));
    assert.deepEqual(bone.position.toArray(), [0, 0, 0]);
    assert.deepEqual(bone.quaternion.toArray(), [0, 0, 0, 1]);
    playback.dispose();
  });

  it('refuses a time past the clip, an unknown clip or an endless one, naming the actor, and changes nothing', () => {
    const {apply, evidence} = fixture('external');
    apply(held(1.25));
    const before = evidence();
    const refusals: Array<[ModelStageActorAnimation, RegExp]> = [
      [held(2.001), /^ModelStageRefusal: Actor p1: clip motion time 2.001 lies outside \[0, 2\]/],
      [held(0, 'missing'), /^ModelStageRefusal: Actor p1: clip missing is not an animation/],
      [{name: 'invalid', playing: false}, /^ModelStageRefusal: Actor p1: clip invalid has no finite/],
      [{name: MODEL_REST_POSE, playing: false, timeSeconds: 0}, /rest pose neither plays nor holds a time/],
      [{name: MODEL_REST_POSE, playing: true}, /rest pose neither plays nor holds a time/],
    ];
    for (const [value, pattern] of refusals) {
      assert.throws(() => apply(value), pattern);
      assert.deepEqual(evidence(), before);
    }
  });

  it('never advances from render/focus updates and refuses local playback under the external clock', () => {
    const {apply, playback, evidence} = fixture('external');
    apply(held(0.75));
    const before = evidence();
    assert.throws(() => apply({name: 'motion', playing: true}), /external clock cannot play/);
    for (const visible of [true, false, true]) {
      for (const delta of [0, 0.016, 1, 600]) playback.update(delta, visible);
      assert.deepEqual(evidence(), before);
    }
    assert.equal(playback.snapshot().playing, false);
  });

  it('plays on the local clock, pauses where it is, holds a time, and keeps hidden tabs still', () => {
    const {bone, apply, playback, evidence} = fixture();
    apply({name: 'motion', playing: true});
    playback.update(0.4, true);
    close(bone.position.x, 1.6);
    const before = evidence();
    playback.update(60, false);
    assert.deepEqual(evidence(), before);
    apply({name: 'motion', playing: false});
    playback.update(60, true);
    close(playback.snapshot().time, 0.4);
    close(bone.position.x, 1.6);
    apply({name: 'motion', playing: true});
    playback.update(1.9, true);
    close(playback.snapshot().time, 0.3);
    close(bone.position.x, 1.2);
    apply(held(1));
    assert.deepEqual([bone.position.x, playback.snapshot().playing], [4, false]);
  });

  it('restores the authored rest pose without inventing a sample', () => {
    const {bone, apply, evidence} = fixture('external');
    apply(held(1));
    apply({name: MODEL_REST_POSE, playing: false});
    assert.deepEqual(bone.position.toArray(), [2, 3, 4]);
    assert.equal(evidence().animation, MODEL_REST_POSE);
  });

  it('supports the sole endpoint of a zero-duration clip', () => {
    const root = new THREE.Group();
    const clip = new THREE.AnimationClip('still', 0, [new THREE.VectorKeyframeTrack('.position', [0], [3, 2, 1])]);
    const playback = createModelPlayback(root, [clip], 'external', 'p1');
    playback.prepareAnimation({name: 'still', playing: false, timeSeconds: 0})();
    assert.deepEqual(root.position.toArray(), [3, 2, 1]);
    assert.equal(playback.snapshot().time, 0);
    assert.throws(() => playback.prepareAnimation({name: 'still', playing: false, timeSeconds: Number.EPSILON}),
      /lies outside/);
  });

  it('defaults the stage policy to local and accepts only the declared clock owners', () => {
    assert.equal(modelStagePolicy().clock, 'local');
    assert.equal(modelStagePolicy({clock: 'external'}).clock, 'external');
    assert.throws(() => modelStagePolicy({clock: 'unknown' as ModelStageClock}), /local or external/);
  });
});
