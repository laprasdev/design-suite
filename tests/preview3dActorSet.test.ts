import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {applyModelFrame, createModelActor} from '../src/react/preview3d/actor.ts';
import {createModelActorSet} from '../src/react/preview3d/actorSet.ts';
import {createModelActorReplacement, modelPreviewReady} from '../src/react/preview3d/actorReplacement.ts';
import {MODEL_STAGE_FAILURE, ModelStageRefusal, modelStageFailure} from '../src/react/preview3d/model.ts';
import type {ModelStageActor} from '../src/react/preview3d/model.ts';
import {actorAsset, actorContext, declaration, entity, frame} from './preview3dActorFixture.ts';

// Each load waits until the test settles it; disposal is observed on the loaded body's geometry.
function harness() {
  const {context, scene} = actorContext();
  const loads: {id: string; settle(fail?: boolean): void; disposed: () => boolean}[] = [];
  const load = (value: ModelStageActor) => new Promise<GLTF>((resolve, reject) => {
    const {asset, body} = actorAsset([{name: 'run', duration: 1}]);
    let disposed = false;
    body.geometry.addEventListener('dispose', () => {disposed = true;});
    loads.push({id: value.id, disposed: () => disposed,
      settle: fail => fail ? reject(new Error(`load ${value.id} failed`)) : resolve(asset)});
  });
  const set = createModelActorSet('otter', load, (asset, value) => createModelActor(asset, value, context));
  const loading = (id: string) => loads.filter(entry => entry.id === id).at(-1)!;
  return {set, scene, loads, loading};
}
const at = (id: string, x = 0, extra: Partial<ModelStageActor> = {}) =>
  declaration(id, 'otter', {placement: {position: [x, 0, 0]}, ...extra});

describe('replacing the declared actors', () => {
  it('keeps an unchanged actor at its new placement, loads the new one and disposes the removed one', async () => {
    const {set, loads, loading} = harness();
    const first = set.replace([at('a'), at('b')]);
    assert.equal(set.pending, true);
    loading('a').settle(); loading('b').settle();
    await first;
    const [a] = set.actors;
    const second = set.replace([at('a', 4), at('c')]);
    assert.deepEqual(loads.map(({id}) => id), ['a', 'b', 'c']);
    assert.deepEqual(set.actors.map(actor => actor.id), ['a', 'b']);
    loading('c').settle();
    await second;
    assert.equal(set.pending, false);
    assert.deepEqual(set.actors.map(actor => actor.id), ['a', 'c']);
    assert.equal(set.actors[0], a);
    assert.deepEqual(a.snapshot().pose.position, [4, 0, 0]);
    assert.equal(loading('b').disposed(), true);
    assert.equal(loading('a').disposed(), false);
  });

  it('leaves the previous set drawn when a load fails, rejects, and disposes what the attempt loaded', async () => {
    const {set, scene, loading} = harness();
    const first = set.replace([at('a')]);
    loading('a').settle();
    await first;
    const drawn = scene.children.length;
    const failing = set.replace([at('b'), at('c')]);
    loading('b').settle(); loading('c').settle(true);
    await assert.rejects(failing, (error: unknown) =>
      error instanceof ModelStageRefusal && /not replaced: load c failed/.test(error.message));
    assert.deepEqual(set.actors.map(actor => actor.id), ['a']);
    assert.equal(scene.children.length, drawn);
    assert.equal(loading('b').disposed(), true);
    assert.equal(set.pending, false);
  });

  it('rejects an asset that loads but cannot be built, keeping the previous set', async () => {
    const {set, loading} = harness();
    const failing = set.replace([at('h', 0, {heldAnimation: 'swim'})]);
    loading('h').settle();
    await assert.rejects(failing, /Actor h: clip swim/);
    assert.deepEqual(set.actors, []);
  });

  it('turns a loader that throws at once into a rejection, ending the attempt', async () => {
    const {context} = actorContext();
    const set = createModelActorSet('otter', () => {throw new Error('bad profile');},
      (asset, value) => createModelActor(asset, value, context));
    await assert.rejects(set.replace([at('a')]), /bad profile/);
    assert.equal(set.pending, false);
    assert.deepEqual(set.actors, []);
  });

  it('lets the later of two overlapping calls win and disposes the earlier attempt\'s arrivals', async () => {
    const {set, loads, loading} = harness();
    const earlier = set.replace([at('a')]), later = set.replace([at('b')]);
    const early = loads[0];
    loading('b').settle();
    await later;
    early.settle();
    await earlier;
    assert.deepEqual(set.actors.map(actor => actor.id), ['b']);
    assert.equal(early.disposed(), true);
    assert.equal(set.pending, false);
  });

  it('refuses at once while an actor is engine-driven, and refuses an invalid set before loading', async () => {
    const {set, loads, loading} = harness();
    const first = set.replace([at('a')]);
    loading('a').settle();
    await first;
    assert.throws(() => set.replace([at('a'), at('a')]), /declared twice/);
    applyModelFrame(set.actors, frame(0, entity('a')));
    assert.throws(() => set.replace([]), /^ModelStageRefusal: Actor a is engine-driven/);
    assert.equal(loads.length, 1);
    assert.deepEqual(set.actors.map(actor => actor.id), ['a']);
  });
});

describe('the view side of a replacement', () => {
  const states = () => {
    const pending: boolean[] = [], failures: unknown[] = [];
    return {pending, failures,
      replacement: createModelActorReplacement(value => pending.push(value), error => failures.push(error))};
  };
  it('drops readiness in flight, restores it after the swap, and hands a rejection on', async () => {
    const {pending, failures, replacement} = states();
    let settle: (fail: boolean) => void = () => undefined;
    const refusal = new ModelStageRefusal('no');
    const api = {setActors: () => new Promise<void>((resolve, reject) =>
      {settle = fail => fail ? reject(refusal) : resolve();})};
    replacement.request(api, []);
    assert.equal(modelPreviewReady(true, false, 'waiting', pending.at(-1) === true), false);
    settle(false);
    await Promise.resolve();
    assert.deepEqual([pending, failures], [[true, false], []]);
    assert.equal(modelPreviewReady(true, false, 'waiting', pending.at(-1) === true), true);
    replacement.request(api, []);
    settle(true);
    await Promise.resolve();
    assert.deepEqual([pending.at(-1), failures], [false, [refusal]]);
  });

  it('reports only the latest call, and passes a synchronous refusal on without a pending state', async () => {
    const {pending, failures, replacement} = states();
    const settles: Array<() => void> = [];
    const api = {setActors: () => new Promise<void>(resolve => {settles.push(resolve);})};
    replacement.request(api, []);
    replacement.request(api, []);
    settles[0]();
    await Promise.resolve();
    assert.deepEqual(pending, [true, true]);
    settles[1]();
    await Promise.resolve();
    assert.deepEqual(pending, [true, true, false]);
    const refusal = new ModelStageRefusal('engine-driven');
    replacement.request({setActors: () => {throw refusal;}}, []);
    assert.deepEqual([pending.length, failures], [3, [refusal]]);
  });
});

describe('the one failure model', () => {
  it('keeps a stage on a refusal, and fails it on anything else or when there is no stage to keep', () => {
    assert.deepEqual(modelStageFailure(new ModelStageRefusal('no frame'), true),
      {kind: MODEL_STAGE_FAILURE.refused, message: 'no frame'});
    assert.deepEqual(modelStageFailure(new Error('broken'), true),
      {kind: MODEL_STAGE_FAILURE.unusable, message: 'broken'});
    assert.deepEqual(modelStageFailure(new ModelStageRefusal('no frame'), false).kind, MODEL_STAGE_FAILURE.unusable);
    assert.deepEqual(modelStageFailure('thrown text', true),
      {kind: MODEL_STAGE_FAILURE.unusable, message: 'thrown text'});
  });
});
