import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {applyModelFrame, createModelActor} from '../src/react/preview3d/actor.ts';
import {createModelActorSet, type ModelActorStaging} from '../src/react/preview3d/actorSet.ts';
import {prepareWhole} from '../src/react/preview3d/commit.ts';
import {ModelStageRefusal} from '../src/react/preview3d/model.ts';
import type {ModelStageActor} from '../src/react/preview3d/model.ts';
import {actorAsset, actorContext, declaration, entity, frame, held, standingAt} from './preview3dActorFixture.ts';

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
  const set = createModelActorSet(load, (asset, value) => createModelActor(asset, value, context));
  const show = (staged: ModelActorStaging) => prepareWhole([staged.prepare])();
  const replace = (...actors: ModelStageActor[]) => set.replace({focus: actors[0]?.id ?? 'none', actors}, [], show);
  const loading = (id: string) => loads.filter(entry => entry.id === id).at(-1)!;
  return {set, scene, loads, loading, replace};
}
const at = (id: string, x = 0, extra: Partial<ModelStageActor> = {}) =>
  declaration(id, 'otter', {placement: standingAt([x, 0, 0]), ...extra});
const ids = (actors: readonly {id: string}[]) => actors.map(actor => actor.id);

describe('replacing the declared actors', () => {
  it('keeps an unchanged actor at its new placement, loads the new one and disposes the removed one', async () => {
    const {set, loads, loading, replace} = harness();
    const first = replace(at('a'), at('b'));
    assert.equal(set.pending, true);
    loading('a').settle(); loading('b').settle();
    await first;
    const [a] = set.actors;
    const second = replace(at('a', 4), at('c'));
    assert.deepEqual(ids(loads), ['a', 'b', 'c']);
    assert.deepEqual(ids(set.actors), ['a', 'b']);
    loading('c').settle();
    await second;
    assert.equal(set.pending, false);
    assert.deepEqual(ids(set.actors), ['a', 'c']);
    assert.equal(set.actors[0], a);
    assert.deepEqual(a.snapshot().pose.position, [4, 0, 0]);
    assert.equal(loading('b').disposed(), true);
    assert.equal(loading('a').disposed(), false);
  });

  it('waits for what the parts need loaded, as for a model, and refuses when that load fails', async () => {
    const {set, loading, replace} = harness();
    const first = replace(at('a'));
    loading('a').settle();
    await first;
    const settle: Array<(fail: boolean) => void> = [];
    const need = () => new Promise<void>((resolve, reject) => {
      settle.push(fail => fail ? reject(new Error('passes failed')) : resolve());
    });
    let shown = 0;
    const waiting = set.replace({focus: 'a', actors: [at('a', 2)]}, [need()], staged => {
      shown++;
      prepareWhole([staged.prepare])();
    });
    assert.deepEqual([set.pending, shown], [true, 0]);
    settle[0](false);
    await waiting;
    assert.deepEqual([set.pending, shown, set.actors[0].snapshot().pose.position], [false, 1, [2, 0, 0]]);
    const failing = set.replace({focus: 'a', actors: [at('a', 3)]}, [need()], () => {shown++;});
    settle[1](true);
    await assert.rejects(failing, (error: unknown) => error instanceof ModelStageRefusal &&
      /passes failed/.test(error.message));
    assert.deepEqual([set.pending, shown, set.actors[0].snapshot().pose.position], [false, 1, [2, 0, 0]]);
  });

  it('applies a set that loads nothing at once, and a set that changes nothing changes nothing', async () => {
    const {set, loading, replace} = harness();
    const first = replace(at('a'));
    loading('a').settle();
    await first;
    const [a] = set.actors;
    let prepared = 0;
    const prepareHost = a.prepareHost;
    a.prepareHost = value => {prepared++; return prepareHost(value);};
    void replace(at('a'));
    assert.equal(prepared, 0);
    void replace(at('a', 0, {animation: held('run', 0.5)}));
    assert.deepEqual([prepared, set.pending, a.snapshot().animation], [1, false, 'run']);
  });

  it('does not restart a load in flight when the next set keeps that actor', async () => {
    const {set, loads, loading, replace} = harness();
    const earlier = replace(at('a'));
    const later = replace(at('a'));
    assert.deepEqual(ids(loads), ['a']);
    loading('a').settle();
    await Promise.all([earlier, later]);
    assert.deepEqual([ids(set.actors), loading('a').disposed(), set.pending], [['a'], false, false]);
  });

  it('lets a refused set supersede nothing: the load in flight still lands and pending clears', async () => {
    const {set, loads, loading, replace} = harness();
    const first = replace(at('a'));
    loading('a').settle();
    await first;
    const adding = replace(at('a'), at('b'));
    assert.throws(() => replace(at('a', 0, {animation: held('swim', 0)})), /^ModelStageRefusal: Actor a: clip swim/);
    loading('b').settle();
    await adding;
    assert.deepEqual([ids(loads), ids(set.actors), loading('b').disposed(), set.pending],
      [['a', 'b'], ['a', 'b'], false, false]);
  });

  it('leaves the previous set drawn when a load fails, refusing, and disposes what the attempt loaded', async () => {
    const {set, scene, loading, replace} = harness();
    const first = replace(at('a'));
    loading('a').settle();
    await first;
    const drawn = scene.children.length;
    const failing = replace(at('b'), at('c'));
    loading('b').settle(); loading('c').settle(true);
    await assert.rejects(failing, (error: unknown) =>
      error instanceof ModelStageRefusal && /not replaced: load c failed/.test(error.message));
    assert.deepEqual(ids(set.actors), ['a']);
    assert.equal(scene.children.length, drawn);
    assert.equal(loading('b').disposed(), true);
    assert.equal(set.pending, false);
  });

  it('fails the first set as it is: with no previous set there is nothing a refusal could keep', async () => {
    const {loading, replace} = harness();
    const failing = replace(at('a'));
    loading('a').settle(true);
    await assert.rejects(failing, (error: unknown) => !(error instanceof ModelStageRefusal) &&
      /load a failed/.test(String(error)));
  });

  it('rejects an asset that loads but cannot be built, and turns a loader that throws into a rejection', async () => {
    const {set, loading, replace} = harness();
    const failing = replace(at('h', 0, {animation: held('swim', 0)}));
    loading('h').settle();
    await assert.rejects(failing, /Actor h: clip swim/);
    assert.deepEqual(set.actors, []);
    const {context} = actorContext();
    const throwing = createModelActorSet(() => {throw new Error('bad profile');},
      (asset, value) => createModelActor(asset, value, context));
    await assert.rejects(throwing.replace({focus: 'a', actors: [at('a')]}, [], () => undefined), /bad profile/);
    assert.equal(throwing.pending, false);
  });

  it('lets the later of two overlapping calls win and disposes the earlier attempt\'s arrivals', async () => {
    const {set, loads, loading, replace} = harness();
    const earlier = replace(at('a')), later = replace(at('b'));
    const early = loads[0];
    loading('b').settle();
    await later;
    early.settle();
    await earlier;
    await Promise.resolve();
    assert.deepEqual(ids(set.actors), ['b']);
    assert.equal(early.disposed(), true);
    assert.equal(set.pending, false);
  });

  it('refuses a set that changes, replaces or removes an engine-driven actor, and lets every other actor change',
    async () => {
      const {set, loading, replace} = harness();
      const first = replace(at('a'), at('b'));
      loading('a').settle(); loading('b').settle();
      await first;
      applyModelFrame(set.actors, frame(0, entity('a')));
      const engineDriven = /^ModelStageRefusal: Actor a is engine-driven/;
      assert.throws(() => replace(at('a', 3), at('b')), engineDriven);
      assert.throws(() => replace(at('b')), engineDriven);
      const replacing = replace(declaration('a', 'heron'), at('b'));
      loading('a').settle();
      await assert.rejects(replacing, engineDriven);
      assert.deepEqual(set.actors[1].snapshot().pose.position, [0, 0, 0]);
      void replace(at('a'), at('b', 6));
      assert.deepEqual(set.actors[1].snapshot().pose.position, [6, 0, 0]);
    });
});
