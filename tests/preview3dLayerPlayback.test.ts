import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';
import {createModelPlayback} from '../src/react/preview3d/playback.ts';
import {MODEL_ANIMATION_SAMPLES, MODEL_REST_POSE, modelAnimationLayers} from '../src/react/preview3d/model.ts';
import type {ModelAnimationLayer, ModelAnimationSample} from '../src/react/preview3d/model.ts';
import {actorAsset, BIND, clipValue, close, layer, sample, type ClipSpec} from './preview3dActorFixture.ts';

const CLIPS: ClipSpec[] = [{name: 'run', duration: 2}, {name: 'walk', duration: 4}];
function fixture(clips = CLIPS) {
  const {asset, bone} = actorAsset(clips);
  const playback = createModelPlayback(asset.scene, asset.animations, 'external', 'p1');
  const play = (...layers: unknown[]) => playback.prepareLayers(modelAnimationLayers(layers, 'p1'))();
  return {playback, bone, play, x: () => bone.position.x, pose: () => bone.position.toArray()};
}

describe('engine layer playback', () => {
  it('sets the bone to its one sample, and repeats it without advancing on render updates', () => {
    const {playback, play, x, pose} = fixture();
    play(layer(sample('walk', 1.5)));
    assert.equal(x(), clipValue(1, 1.5));
    const before = pose();
    for (const delta of [0, 0.016, 1, 600]) playback.update(delta, true);
    assert.deepEqual(pose(), before);
    play(layer(sample('walk', 1.5)));
    assert.deepEqual(pose(), before);
  });

  it('blends a cross-fade pair at w and 1 - w, fills the rest of a short sum from the bind pose', () => {
    const {play, x, bone} = fixture();
    for (const w of [0, 0.25, 0.5, 0.9, 1]) {
      play(layer(sample('run', 1, 1 - w), sample('walk', 3, w, 'base/walk#1')));
      close(x(), (1 - w) * clipValue(0, 1) + w * clipValue(1, 3));
    }
    play(layer(sample('run', 0.5, 0.4)));
    close(x(), 0.4 * clipValue(0, 0.5) + 0.6 * BIND[0]);
    close(bone.position.y, 0.6 * BIND[1]);
    play({...layer(sample('run', 0.5)), weight: 0.5});
    close(x(), 0.5 * clipValue(0, 0.5) + 0.5 * BIND[0]);
  });

  it('plays one clip in two samples at two times, and stops a departed sample', () => {
    const {play, x} = fixture();
    play(layer(sample('run', 0.5, 0.5, 'a'), sample('run', 1.5, 0.5, 'b')));
    close(x(), 0.5 * clipValue(0, 0.5) + 0.5 * clipValue(0, 1.5));
    play(layer(sample('walk', 2, 1, 'c')));
    close(x(), clipValue(1, 2));
  });

  it('refuses an unknown clip or a time past the clip, naming the actor and the clip, and applies nothing', () => {
    const {playback, play, pose} = fixture();
    play(layer(sample('run', 1)));
    const before = pose();
    assert.throws(() => play(layer(sample('run', 0.5, 0.5), sample('swim', 0, 0.5))),
      /^ModelStageRefusal: Actor p1: clip swim is not an animation in the model file/);
    assert.throws(() => play(layer(sample('walk', 4.001))),
      /^ModelStageRefusal: Actor p1: clip walk time 4.001 lies outside/);
    assert.deepEqual(pose(), before);
    assert.deepEqual(playback.review().samples.map(({clipId}) => clipId), ['run']);
    const endless = fixture([{name: 'loop', duration: Infinity}]);
    assert.throws(() => endless.play(layer(sample('loop', 1))),
      /^ModelStageRefusal: Actor p1: clip loop has no finite/);
  });

  it('returns to the rest pose on [] and reports samples, not a clip and time, while they play', () => {
    const {playback, play, pose} = fixture();
    assert.deepEqual(playback.review(), {animation: MODEL_REST_POSE, time: 0, playing: false, samples: []});
    play(layer(sample('run', 1, 0.5), sample('walk', 2, 0.5, 'w')));
    const {animation, time, samples} = playback.review();
    assert.deepEqual({animation, time}, {animation: MODEL_ANIMATION_SAMPLES, time: null});
    assert.deepEqual(samples, [sample('run', 1, 0.5), sample('walk', 2, 0.5, 'w')]);
    play();
    assert.deepEqual(pose(), [...BIND]);
    assert.deepEqual(playback.review(), {animation: MODEL_REST_POSE, time: 0, playing: false, samples: []});
  });

  it('holds the host selection under [] and hides it while samples play', () => {
    const {playback, play, x} = fixture();
    playback.setAnimation('walk');
    assert.equal(x(), clipValue(1, 0));
    play(layer(sample('run', 1)));
    assert.equal(x(), clipValue(0, 1));
    play();
    assert.equal(x(), clipValue(1, 0));
  });

  it('refuses host clip commands once layers apply, and layers under the local clock', () => {
    const {playback, play, pose} = fixture();
    play();
    const before = pose();
    assert.throws(() => playback.setAnimation('run'), /drive this model/);
    assert.throws(() => playback.setAnimationTime(0), /drive this model/);
    assert.deepEqual(pose(), before);
    const {asset} = actorAsset(CLIPS);
    const local = createModelPlayback(asset.scene, asset.animations, 'local', 'p1');
    assert.throws(() => local.prepareLayers([]), /external clock/);
  });
});

interface EngineFixture {
  stepSeconds: number;
  clips: Record<string, {lengthSeconds: number}>;
  ticks: {tick: number; animationLayers: ModelAnimationLayer[]}[];
}
describe('engine frames read from a file', () => {
  it('sets the bone to the weighted sum of each tick\'s samples, as the fixture states them', () => {
    const data = JSON.parse(readFileSync(new URL('./preview3dEngineLayers.fixture.json', import.meta.url), 'utf8'));
    const engine = data as EngineFixture, names = Object.keys(engine.clips);
    const {playback, play, x} = fixture(names.map(name => ({name, duration: engine.clips[name].lengthSeconds})));
    assert.ok(engine.ticks.length > 0);
    for (const {animationLayers} of engine.ticks) {
      play(...animationLayers);
      const expected = animationLayers.flatMap(({weight, samples}) => samples.map((entry: ModelAnimationSample) =>
        ({value: clipValue(names.indexOf(entry.clipId), entry.timeSeconds), weight: weight * entry.weight})));
      const total = expected.reduce((sum, {weight}) => sum + weight, 0);
      close(x(), expected.reduce((sum, {value, weight}) => sum + value * weight, 0) + (1 - total) * BIND[0], 1e-5);
      assert.deepEqual(playback.review().samples.map(({sampleId}) => sampleId),
        animationLayers.flatMap(({samples}) => samples.map(({sampleId}) => sampleId)));
    }
  });
});
