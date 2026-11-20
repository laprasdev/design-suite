import {modelActorDrawsFile, type ModelStageActor, type ModelStageActorSet} from './actorModel.ts';
import {MODEL_ACTOR_SURFACES, modelSurfaceSetWhere, type ModelSurfaceSet, type ModelSurfaceSource}
  from './surfaceModel.ts';
import {modelTerrainChunks} from './terrainModel.ts';

// What draws each actor's renderers, as one form for both sources: a file actor's surfaces and the description's sets;
// a terrain's one record as a set of its own, keyed by its chunks, so one checker and one applier serve both; a
// refusal of that record names the field its author wrote, the actor's `surface`. Three-free.
const terrainSetName = (actor: string) => `terrain ${actor}`;

/** What draws an actor's renderers, and the sets its surfaces may name. */
export function modelActorSurfaceSource(actor: ModelStageActor,
  sets: Readonly<Record<string, ModelSurfaceSet>>): ModelSurfaceSource {
  if (modelActorDrawsFile(actor)) return Object.freeze({surfaces: actor.surfaces, sets, where: modelSurfaceSetWhere});
  const name = terrainSetName(actor.id);
  const set: ModelSurfaceSet = Object.freeze(Object.fromEntries(modelTerrainChunks(actor.terrain)
    .map(({id}) => [id, actor.surface])));
  return Object.freeze({surfaces: Object.freeze({from: MODEL_ACTOR_SURFACES.set, set: name}),
    sets: Object.freeze({[name]: set}), where: () => `Actor ${actor.id}.surface`});
}

/** Every actor's source, in the set's order. */
export const modelActorSurfaceSources = (actors: ModelStageActorSet,
  sets: Readonly<Record<string, ModelSurfaceSet>>) =>
  actors.actors.map(actor => modelActorSurfaceSource(actor, sets));

