import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModelObject} from './asset.ts';
import {MODEL_STAGE_DRIVER, modelActorIdentity, modelStageActors} from './actorModel.ts';
import type {ModelStageActor} from './actorModel.ts';
import type {ModelActor} from './actor.ts';
import type {ModelStageTransform} from './model.ts';
import {ModelStageRefusal} from './refusal.ts';

export const MODEL_ACTOR_SET_TEXT = Object.freeze({
  engineDriven: (id: string) => `Actor ${id} is engine-driven; the declared actors cannot be replaced under it.`,
  failed: (message: string) => `The declared actors were not replaced: ${message}`,
});
// A declaration's placement is whole: a field it leaves out is the identity, not the previous value.
const IDENTITY_PLACEMENT = Object.freeze({position: [0, 0, 0], rotationQuaternion: [0, 0, 0, 1],
  scale: [1, 1, 1]} as const satisfies ModelStageTransform);
const fullPlacement = (value: ModelStageTransform): ModelStageTransform => ({...IDENTITY_PLACEMENT, ...value});
interface Entry {readonly actor: ModelActor; readonly declaration: ModelStageActor}
type Load = (declaration: ModelStageActor, signal: AbortSignal) => Promise<GLTF>;
type Build = (asset: GLTF, declaration: ModelStageActor) => ModelActor;

// The declared actors beside the character. A replacement keeps unchanged actors, loads the rest in parallel and
// swaps in one step; a later call supersedes an earlier one, whose arrivals are disposed.
export function createModelActorSet(characterId: string, load: Load, build: Build) {
  let entries: readonly Entry[] = [], attempt = 0, request: AbortController | undefined, disposed = false;
  const refuseEngineDriven = () => {
    const driven = entries.find(({actor}) => actor.driver === MODEL_STAGE_DRIVER.engine);
    if (driven) throw new ModelStageRefusal(MODEL_ACTOR_SET_TEXT.engineDriven(driven.actor.id));
  };
  const swap = (next: readonly ModelStageActor[], kept: ReadonlyMap<string, Entry>, built: readonly ModelActor[]) => {
    refuseEngineDriven();
    for (const entry of entries) if (!kept.has(entry.actor.id)) entry.actor.dispose();
    let index = 0;
    entries = next.map(declaration => {
      const entry = kept.get(declaration.id);
      if (!entry) return {actor: built[index++], declaration};
      entry.actor.setPlacement(fullPlacement(declaration.placement));
      return {actor: entry.actor, declaration};
    });
  };
  // Ends this attempt's pending state, and says whether a later call or disposal has superseded it.
  const superseded = (current: number, controller: AbortController) => {
    if (current === attempt) request = undefined;
    return current !== attempt || disposed || controller.signal.aborted;
  };
  return {
    get actors(): readonly ModelActor[] {return entries.map(({actor}) => actor);},
    get pending() {return request !== undefined;},
    // Throws at once for an invalid set or an engine-driven actor; otherwise settles when the attempt does.
    replace(value: unknown): Promise<void> {
      const next = modelStageActors(value, characterId);
      refuseEngineDriven();
      const current = ++attempt, controller = new AbortController();
      request?.abort();
      request = controller;
      const kept = new Map(entries.filter(({actor, declaration}) => next.some(candidate =>
        modelActorIdentity(candidate) === modelActorIdentity(declaration))).map(entry => [entry.actor.id, entry]));
      const fresh = next.filter(declaration => !kept.has(declaration.id));
      // A loader that throws at once is a failed load like any other, not a half-started attempt.
      const loads = fresh.map(declaration =>
        new Promise<GLTF>(resolve => resolve(load(declaration, controller.signal))));
      return Promise.allSettled(loads).then(results => {
        const arrived = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        const failure = results.find(result => result.status === 'rejected');
        const discard = () => {for (const asset of arrived) disposeModelObject(asset.scene);};
        if (superseded(current, controller)) return discard();
        if (failure) {
          discard();
          throw failure.reason;
        }
        const built: ModelActor[] = [];
        try {
          arrived.forEach((asset, index) => built.push(build(asset, fresh[index])));
          swap(next, kept, built);
        } catch (error) {
          for (const actor of built) actor.dispose();
          for (const asset of arrived.slice(built.length)) disposeModelObject(asset.scene);
          throw error;
        }
      }).catch((error: unknown) => {
        // A replacement that could not be shown leaves the previous set drawn: that is a refusal, whatever failed.
        if (error instanceof ModelStageRefusal) throw error;
        throw new ModelStageRefusal(MODEL_ACTOR_SET_TEXT.failed(error instanceof Error ? error.message : String(error)),
          {cause: error});
      });
    },
    dispose() {
      disposed = true;
      request?.abort();
      request = undefined;
      for (const {actor} of entries) actor.dispose();
      entries = [];
    },
  };
}
