import type {ModelStageActor, ModelStageActorSet} from './actorModel.ts';
import {MODEL_ACTOR_REFUSAL as refusal, modelRuntimeAssetProfile} from './actorModel.ts';
import {MODEL_PREVIEW_ENTITY_REFUSAL, modelPreviewEntity, type ModelPreviewEntity} from './presentation.ts';
import {modelIsNamed as named, modelIsRecord as object} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelSurfaceSet} from './surfaceModel.ts';
import {modelSurfaceTakes, type ModelSurfaceTakes} from './surfaceOutputModel.ts';
import type {ModelSurfaceKind} from './surfaceKindModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';

// An engine frame as the stage takes it: what it is checked against (the description in force), and the check.
// The stage's own frame, built by the host: every entity names a declared actor, so an unknown id is refused.
export interface ModelPreviewFrame {
  readonly simulationTimeSeconds: number;
  readonly entities: readonly ModelPreviewEntity[];
}
/** What a frame is checked against: the declared actors and, by actor id, what each one's renderers take. */
export interface ModelFrameScope {
  readonly actors: readonly ModelStageActor[];
  readonly takes: ReadonlyMap<string, ModelRuntimeMaterialProfile | ModelSurfaceTakes>;
}
/** A description's frame scope, made once when it is applied: an actor with a runtime profile takes through it (the
 * description refuses one with a set too), every other one through its surfaces. */
export function modelFrameScope(value: {readonly actors: ModelStageActorSet;
  readonly surfaceSets: Readonly<Record<string, ModelSurfaceSet>>},
kinds: ReadonlyMap<string, ModelSurfaceKind>): ModelFrameScope {
  const {actors} = value.actors;
  return Object.freeze({actors, takes: new Map(actors.map(actor => [actor.id,
    modelRuntimeAssetProfile(actor) ?? modelSurfaceTakes(actor.surfaces, value.surfaceSets, kinds)]))});
}

/**
 * One engine frame, checked against the description in force before anything applies it. Its own record is written
 * out here rather than through the record owner (recordModel.ts): it is the engine's per-tick presentation frame, which
 * carries fields of its own beyond the stage's (an entity's instance and session, the frame's tick) that the stage
 * neither reads nor refuses, and `removedEntities` is the engine's to state or leave out. What the stage does read is
 * checked whole: an entity by `modelPreviewEntity`, its pose by the record owner.
 */
export function modelPreviewFrame(value: unknown, scope: ModelFrameScope): ModelPreviewFrame {
  const {actors} = scope;
  const time = object(value) ? value.simulationTimeSeconds : undefined;
  if (!object(value) || typeof time !== 'number' || !Number.isFinite(time) || time < 0 ||
    !Array.isArray(value.entities)) {
    throw new ModelStageRefusal(refusal.frame);
  }
  if (value.removedEntities !== undefined &&
    (!Array.isArray(value.removedEntities) || value.removedEntities.length)) {
    throw new ModelStageRefusal(refusal.removed);
  }
  const declared = new Map(actors.map(entry => [entry.id, entry])), seen = new Set<string>();
  const entities = Array.from(value.entities, (entity: unknown) => {
    const id = object(entity) ? entity.entityId : undefined;
    if (!named(id)) throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.entity);
    const actor = declared.get(id);
    if (!actor) throw new ModelStageRefusal(refusal.undeclared(id));
    if (seen.has(id)) throw new ModelStageRefusal(refusal.twice(id));
    seen.add(id);
    return modelPreviewEntity(entity, actor.asset.id, scope.takes.get(id));
  });
  return Object.freeze({simulationTimeSeconds: time, entities: Object.freeze(entities)});
}
