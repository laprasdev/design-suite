import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {MODEL_ANIMATION_LAYER, modelAnimationLayers, modelPreviewEntity} from '../src/react/preview3d/model.ts';
import {createModelFrameInbox} from '../src/react/preview3d/frameInbox.ts';
import {declaration} from './preview3dActorFixture.ts';
import {ModelStageRefusal} from '../src/react/preview3d/model.ts';

const sample = (clipId = 'run', weight = 1, timeSeconds = 0.5, sampleId = `base/${clipId}#0`) =>
  ({sampleId, clipId, timeSeconds, weight});
const layer = (samples: unknown[] = [sample()], extra: Record<string, unknown> = {}) =>
  ({layerId: 'base', weight: 1, blendMode: MODEL_ANIMATION_LAYER.override, samples, ...extra});
const refuses = (value: unknown, pattern: RegExp) =>
  assert.throws(() => modelAnimationLayers(value, 'otter-1'), pattern);
const namesActorAndClip = (clip: string) => new RegExp(`^ModelStageRefusal: Actor otter-1: .*${clip}`);

describe('engine animation layers', () => {
  it('accepts one override layer and returns frozen copies that keep no caller array', () => {
    const samples = [sample('run', 0.25), sample('walk', 0.75, 1.5)];
    const source = [layer(samples)];
    const accepted = modelAnimationLayers(source, 'otter-1');
    samples[0].timeSeconds = 9;
    samples.push(sample('jump'));
    assert.deepEqual(accepted, [layer([sample('run', 0.25), sample('walk', 0.75, 1.5)])]);
    assert.ok(Object.isFrozen(accepted) && Object.isFrozen(accepted[0]) && Object.isFrozen(accepted[0].samples));
    assert.ok(Object.isFrozen(accepted[0].samples[0]));
    assert.notEqual(accepted[0].samples, samples);
  });

  it('accepts no layers, a zero-weight entry sample and weights that sum to one within rounding', () => {
    assert.deepEqual(modelAnimationLayers([], 'otter-1'), []);
    assert.equal(modelAnimationLayers([layer([sample('run', 1, 1), sample('walk', 0, 0)])], 'a')[0].samples.length, 2);
    assert.equal(modelAnimationLayers([layer([sample('run', 0.7), sample('walk', 0.3 + 1e-7)])], 'a').length, 1);
    assert.equal(modelAnimationLayers([layer([sample('run', 1 + 1e-7)])], 'a')[0].samples[0].weight, 1 + 1e-7);
  });

  it('refuses a mask, an additive layer, a second layer and an unknown blend, naming the actor and clips', () => {
    refuses([layer([sample('run')], {maskId: 'upper'})], namesActorAndClip('run.*maskId'));
    refuses([layer([sample('run')], {blendMode: MODEL_ANIMATION_LAYER.additive})], namesActorAndClip('run.*additive'));
    refuses([layer([sample('run')]), {...layer([sample('wave', 1, 0, 'arms#0')]), layerId: 'arms'}],
      namesActorAndClip('run, wave.*at most 1'));
    refuses([layer([sample('run')], {blendMode: 'multiply'})],
      /^ModelStageRefusal: Actor otter-1: layer base has an unknown blendMode/);
  });

  it('refuses each malformed sample, naming the actor and the clip', () => {
    const malformed: Array<[unknown, string]> = [
      [{...sample(), sampleId: ''}, 'run'], [{...sample(), clipId: 7}, '\\?'],
      [{...sample(), timeSeconds: -0.01}, 'run'], [{...sample(), timeSeconds: Infinity}, 'run'],
      [{...sample(), timeSeconds: '0.5'}, 'run'], [{...sample(), weight: 1.01}, 'run'],
      [{...sample(), weight: -0.1}, 'run'], [{...sample(), weight: NaN}, 'run'], [null, '\\?'], [['run'], '\\?'],
    ];
    for (const [value, clip] of malformed) {
      refuses([layer([value])], namesActorAndClip(`clip ${clip}: a sample requires`));
    }
  });

  it('refuses repeated sample ids, over-full weights, an empty layer and malformed layers', () => {
    refuses([layer([sample('run', 0.5), sample('walk', 0.5, 0, 'base/run#0')])], namesActorAndClip('walk.*repeated'));
    refuses([layer([sample('run', 0.5), sample('walk', 0.51)])], namesActorAndClip('run, walk.*summing past 1'));
    refuses([layer([])], /^ModelStageRefusal: Actor otter-1: layer base has no samples/);
    for (const value of [null, {}, {...layer(), layerId: ''}, {...layer(), weight: 2}, {...layer(), samples: {}}]) {
      refuses([value], /^ModelStageRefusal: Actor otter-1: an animation layer requires/);
    }
    for (const value of [null, {}, 'base']) {
      refuses(value, /^ModelStageRefusal: Actor otter-1: animationLayers must be an array/);
    }
  });

  it('validates layers on a frame entity, naming that entity', () => {
    const input = (animationLayers: unknown, entityId = 'otter') => ({entityId, modelId: 'otter', animationLayers,
      partPoses: [], materials: [],
      pose: {position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1], scale: [1, 1, 1]}});
    assert.deepEqual(modelPreviewEntity(input([layer()]), 'otter').animationLayers, [layer()]);
    assert.throws(() => modelPreviewEntity(input([layer([sample()], {maskId: 'm'})]), 'otter'),
      /^ModelStageRefusal: Actor otter: layer base \(clips run\)/);
    assert.throws(() => modelPreviewEntity(input([layer([sample()], {maskId: 'm'})], 'p2'), 'otter'),
      /^ModelStageRefusal: Actor p2: /);
    assert.throws(() => modelPreviewEntity({...input([]), partPoses: [{}]}, 'otter'), /partPoses/);
    const missing: Record<string, unknown> = input([]);
    delete missing.animationLayers;
    assert.throws(() => modelPreviewEntity(missing, 'otter'), /animationLayers must be an array/);
  });

  it('keeps what failed on the inbox, bound, until the next accepted frame', () => {
    const input = (animationLayers: unknown) => ({simulationTimeSeconds: 0, entities: [{entityId: 'otter',
      modelId: 'otter', animationLayers, partPoses: [], materials: [],
      pose: {position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1], scale: [1, 1, 1]}}]});
    const frameInbox = createModelFrameInbox(), actors = [declaration('otter')];
    const inbox = {...frameInbox, receive: (value: unknown) => frameInbox.receive(value, actors),
      get failure() {return frameInbox.failure;}};
    const failure = () => inbox.failure;
    const message = () => {const value = failure(); return value instanceof Error ? value.message : value;};
    assert.equal(failure(), undefined);
    assert.equal(inbox.receive(input([layer([sample()], {maskId: 'm'})])), 'error');
    assert.ok(failure() instanceof ModelStageRefusal);
    assert.match(String(message()), /^Actor otter: layer base \(clips run\) has a maskId/);
    assert.equal(inbox.receive(input([layer()])), 'pending');
    assert.equal(failure(), undefined);
    const unknownClip = new Error('an unexpected apply failure');
    assert.equal(inbox.attach(() => {throw unknownClip;}), 'error');
    assert.equal(failure(), unknownClip);
    assert.equal(inbox.attach(() => undefined), 'error');
    assert.equal(inbox.receive(input([])), 'ready');
    assert.equal(failure(), undefined);
  });
});
