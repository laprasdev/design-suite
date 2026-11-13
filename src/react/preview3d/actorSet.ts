import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModelObject} from './asset.ts';
import {MODEL_STAGE_DRIVER, modelActorHostChanged, modelActorIdentity} from './actorModel.ts';
import type {ModelStageActor, ModelStageActorSet} from './actorModel.ts';
import type {ModelActor} from './actor.ts';
import {prepareWhole, type ModelStageCommit} from './commit.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelStagedLoad} from './fileCache.ts';

export const MODEL_ACTOR_SET_TEXT = Object.freeze({
  engineDriven: (id: string) => `Actor ${id} is engine-driven; a description cannot change, replace or remove it.`,
  failed: (message: string) => `The declared actors were not replaced: ${message}`,
});
type Load = (declaration: ModelStageActor, signal: AbortSignal) => Promise<GLTF>;
type Build = (asset: GLTF, declaration: ModelStageActor) => ModelActor;
interface Loading {readonly key: string; readonly controller: AbortController; readonly asset: Promise<GLTF>}
/** The actors a set would show, and the one prepare that checks and swaps them in. */
export interface ModelActorStaging {readonly actors: readonly ModelActor[]; readonly prepare: () => ModelStageCommit}

// The declared actors. A set keeps every actor whose asset is unchanged, drawn or still loading, loads the rest in
// parallel and hands the staged set to `show` once they arrive (at once when nothing loads). A later call
// supersedes an earlier one; a load no later set wants is aborted and its arrival disposed.
export function createModelActorSet(load: Load, build: Build) {
  let drawn: readonly ModelActor[] = [], focus: string | undefined, attempt = 0, disposed = false;
  const loading = new Map<string, Loading>();
  // What a set also waits for beside its models (the parts' loads, each owned and cached by its part), while in flight,
  // and the release of the attempt in flight's: a later attempt that is taken lets go of what the earlier waited on.
  const waiting = new Set<Promise<void>>();
  let letGo: (() => void) | undefined;
  const drop = (entry: Loading) => {
    loading.delete(entry.key);
    entry.controller.abort();
    // Nothing waits on a dropped load: its asset, if it arrives, is disposed, and its failure concerns no request.
    void Promise.allSettled([entry.asset]).then(([result]) => {
      if (result.status === 'fulfilled') disposeModelObject(result.value.scene);
    });
  };
  const fetch = (declaration: ModelStageActor) => {
    const key = modelActorIdentity(declaration), pending = loading.get(key);
    if (pending) return pending;
    const controller = new AbortController();
    // A loader that throws at once is a failed load like any other, not a half-started attempt.
    const entry = {key, controller, asset: new Promise<GLTF>(resolve => resolve(load(declaration, controller.signal)))};
    loading.set(key, entry);
    return entry;
  };
  // One rule for engine-driven actors: a set may not change, replace or remove one. Everything else may change.
  const refuseEngineChange = (next: readonly ModelStageActor[]) => {
    for (const actor of drawn) {
      if (actor.driver !== MODEL_STAGE_DRIVER.engine) continue;
      const declared = next.find(candidate => candidate.id === actor.id);
      if (!declared || modelActorIdentity(declared) !== modelActorIdentity(actor.declaration) ||
        modelActorHostChanged(actor.declaration, declared)) {
        throw new ModelStageRefusal(MODEL_ACTOR_SET_TEXT.engineDriven(actor.id));
      }
    }
  };
  const staging = (next: ModelStageActorSet, kept: ReadonlyMap<string, ModelActor>,
    built: readonly ModelActor[]): ModelActorStaging => {
    let index = 0;
    const actors = next.actors.map(declaration => kept.get(declaration.id) ?? built[index++]);
    return {actors, prepare() {
      refuseEngineChange(next.actors);
      const hosts = prepareWhole(next.actors.flatMap((declaration, position) => {
        const actor = kept.get(declaration.id);
        return actor && modelActorHostChanged(actor.declaration, declaration) ?
          [() => actors[position].prepareHost(declaration)] : [];
      }));
      return () => {
        hosts();
        for (const actor of drawn) if (!actors.includes(actor)) actor.dispose();
        drawn = actors;
        focus = next.focus;
      };
    }};
  };
  // A model's load or build failure is a refusal while a previous set stands; the stage's first set fails as it is. A
  // part's own load refuses in its own words (fileCache.ts, draw.ts).
  const failure = (error: unknown) => !drawn.length || error instanceof ModelStageRefusal ? error :
    new ModelStageRefusal(MODEL_ACTOR_SET_TEXT.failed(error instanceof Error ? error.message : String(error)),
      {cause: error});
  const buildAll = (assets: readonly GLTF[], fresh: readonly ModelStageActor[]) => {
    const built: ModelActor[] = [];
    try {
      assets.forEach((asset, index) => built.push(build(asset, fresh[index])));
      return built;
    } catch (error) {
      for (const actor of built) actor.dispose();
      for (const asset of assets.slice(built.length)) disposeModelObject(asset.scene);
      throw failure(error);
    }
  };
  return {
    get actors(): readonly ModelActor[] {return drawn;},
    get focused(): ModelActor | undefined {return drawn.find(actor => actor.id === focus);},
    get pending() {return loading.size > 0 || waiting.size > 0;},
    // Throws at once when nothing loads; otherwise settles when this attempt does, or when a later one supersedes it.
    // `needs` are what the description's other parts need loaded first; the staged set waits for them as for models,
    // and releases them once it is shown, refused or superseded.
    replace(next: ModelStageActorSet, needs: ModelStagedLoad,
      show: (staged: ModelActorStaging) => void): Promise<void> {
      const kept = new Map(drawn.filter(actor => next.actors.some(declaration =>
        modelActorIdentity(declaration) === modelActorIdentity(actor.declaration))).map(actor => [actor.id, actor]));
      const fresh = next.actors.filter(declaration => !kept.has(declaration.id));
      // A set supersedes the attempts before it only once it is taken: a refusal leaves their loads running.
      const supersede = (wanted: readonly Loading[]) => {
        for (const entry of [...loading.values()]) if (!wanted.includes(entry)) drop(entry);
        letGo?.();
        letGo = needs.release;
        return ++attempt;
      };
      const finish = (assets: readonly GLTF[]) => {
        const built = buildAll(assets, fresh);
        try {
          show(staging(next, kept, built));
        } catch (error) {
          for (const actor of built) if (!drawn.includes(actor)) actor.dispose();
          throw error;
        }
      };
      if (!fresh.length && !needs.pending.length) {
        try {
          finish([]);
          supersede([]);
        } finally {needs.release();}
        return Promise.resolve();
      }
      const wanted = fresh.map(fetch), current = supersede(wanted);
      for (const need of needs.pending) waiting.add(need);
      const awaited = Promise.allSettled(needs.pending).then(results => {
        for (const need of needs.pending) waiting.delete(need);
        return results;
      });
      return Promise.all([Promise.allSettled(wanted.map(entry => entry.asset)), awaited]).then(([results, other]) => {
        // Superseded: the later attempt has taken these loads over or dropped them, and let go of these needs.
        if (current !== attempt || disposed) return;
        try {
          for (const entry of wanted) loading.delete(entry.key);
          const arrived = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
          const model = results.find(result => result.status === 'rejected');
          const part = other.find(result => result.status === 'rejected');
          if (model || part) {
            for (const asset of arrived) disposeModelObject(asset.scene);
            throw model ? failure(model.reason) : part!.reason;
          }
          finish(arrived);
        } finally {
          letGo = undefined;
          needs.release();
        }
      });
    },
    dispose() {
      disposed = true;
      letGo?.();
      for (const entry of [...loading.values()]) drop(entry);
      for (const actor of drawn) actor.dispose();
      drawn = [];
    },
  };
}
