// The actor set's test harness, shared by its tests and the staged-load tests: synthetic actors whose loads wait
// until the test settles them.
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {createModelActor} from '../src/react/preview3d/actor.ts';
import {createModelActorSet, type ModelActorStaging} from '../src/react/preview3d/actorSet.ts';
import {prepareWhole} from '../src/react/preview3d/commit.ts';
import type {ModelStageActor} from '../src/react/preview3d/model.ts';
import {NO_LOAD, actorAsset, actorContext, declaration, standingAt} from './preview3dActorFixture.ts';

// Each load waits until the test settles it; disposal is observed on the loaded body's geometry.
export function harness() {
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
  const replace = (...actors: ModelStageActor[]) =>
    set.replace({focus: actors[0]?.id ?? 'none', actors}, NO_LOAD, show);
  const loading = (id: string) => loads.filter(entry => entry.id === id).at(-1)!;
  return {set, scene, loads, loading, replace};
}
export const at = (id: string, x = 0, extra: Partial<ModelStageActor> = {}) =>
  declaration(id, 'otter', {placement: standingAt([x, 0, 0]), ...extra});
