import type {ModelStageActor, ModelStageActorSet} from './actorModel.ts';
import {MODEL_ACTOR_REFUSAL as refusal, modelActorDrawsFile, modelRuntimeAssetProfile} from './actorModel.ts';
import {MODEL_PREVIEW_ENTITY_REFUSAL, modelPreviewCamera, modelPreviewEntity, readModelPreviewCamera,
  type ModelPreviewCamera, type ModelPreviewEntity} from './presentation.ts';
import {isNonEmptyString as named, isRecord as object} from '../../valueChecks.ts';
import {modelRecordStating, modelStates} from './recordModel.ts';
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
  readonly camera?: ModelPreviewCamera;
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
  return Object.freeze({actors, takes: new Map(actors.filter(modelActorDrawsFile).map(actor => [actor.id,
    modelRuntimeAssetProfile(actor) ?? modelSurfaceTakes(actor.surfaces, value.surfaceSets, kinds)]))});
}

const FRAME_CAMERA_WHERE = 'Frame camera';
const FRAME_CAMERA_FIELDS = Object.freeze({stated: ['position', 'target'], whenStated: ['fieldOfView']});

/** Validates a frame's time and entities against `scope`; shared by `modelPreviewFrame` and `applyModelFrame`. */
export function readModelFrameEntities(value: unknown, scope: ModelFrameScope) {
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
    if (!modelActorDrawsFile(actor)) throw new ModelStageRefusal(refusal.terrainFrame(id));
    seen.add(id);
    return modelPreviewEntity(entity, actor.asset.id, scope.takes.get(id));
  });
  return {record: value, time, entities};
}

/** Validates an optional frame camera into `into` (`CAMERA_COORDS`); returns 0 (absent), 1 (no fov) or 2 (with fov). */
export function readModelFrameCamera(record: Record<string, unknown>, into: Float64Array): 0 | 1 | 2 {
  if (!modelStates(record, 'camera')) return 0;
  modelRecordStating(record.camera, FRAME_CAMERA_FIELDS, FRAME_CAMERA_WHERE);
  return readModelPreviewCamera(record.camera, FRAME_CAMERA_WHERE, into) ? 2 : 1;
}

/**
 * One engine frame, checked against the description in force before anything applies it. Its own record is written
 * out here rather than through the record owner (recordModel.ts): it is the engine's per-tick presentation frame, which
 * carries fields of its own beyond the stage's (an entity's instance and session, the frame's tick) that the stage
 * neither reads nor refuses, and `removedEntities` is the engine's to state or leave out. What the stage does read is
 * checked whole: an entity by `modelPreviewEntity`, its pose and camera by the record owner.
 */
export function modelPreviewFrame(value: unknown, scope: ModelFrameScope): ModelPreviewFrame {
  const {record, time, entities} = readModelFrameEntities(value, scope);
  if (!modelStates(record, 'camera')) {
    return Object.freeze({simulationTimeSeconds: time, entities: Object.freeze(entities)});
  }
  modelRecordStating(record.camera, FRAME_CAMERA_FIELDS, FRAME_CAMERA_WHERE);
  const camera = modelPreviewCamera(record.camera, FRAME_CAMERA_WHERE);
  return Object.freeze({simulationTimeSeconds: time, entities: Object.freeze(entities), camera});
}
