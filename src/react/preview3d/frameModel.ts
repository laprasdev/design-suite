import type {ModelStageActor, ModelStageActorSet} from './actorModel.ts';
import {MODEL_ACTOR_REFUSAL as refusal, modelActorDrawsFile, modelRuntimeAssetProfile} from './actorModel.ts';
import {CAMERA_COORDS, freezeModelPreviewCamera, MODEL_PREVIEW_CAMERA_FIELDS, MODEL_PREVIEW_ENTITY_REFUSAL,
  modelPreviewCameraWhere, modelPreviewEntity, readModelPreviewCamera,
  type ModelPreviewCamera, type ModelPreviewEntity} from './presentation.ts';
import {isNonEmptyString as named, isRecord as object} from '../../valueChecks.ts';
import {modelRecordIdentity, modelRecordStating, modelStates} from './recordModel.ts';
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
/** A validated frame ready for the stage to apply without re-reading or allocating a frozen camera record. */
export interface ModelValidatedFrame {
  readonly simulationTimeSeconds: number;
  readonly entities: readonly ModelPreviewEntity[];
  readonly cameraCoordinates: Float64Array | null;
}
/** What a frame is checked against: the declared actors and, by actor id, what each one's renderers take. */
export interface ModelFrameScope {
  readonly actors: readonly ModelStageActor[];
  readonly takes: ReadonlyMap<string, ModelRuntimeMaterialProfile | ModelSurfaceTakes>;
}
const scopeKeys = new WeakMap<ModelFrameScope, string>();
const validatedFrames = new WeakMap<object, {readonly frame: ModelValidatedFrame; readonly scopeKey: string}>();

/** A description's frame scope, made once when it is applied: an actor with a runtime profile takes through it (the
 * description refuses one with a set too), every other one through its surfaces. */
export function modelFrameScope(value: {readonly actors: ModelStageActorSet;
  readonly surfaceSets: Readonly<Record<string, ModelSurfaceSet>>},
kinds: ReadonlyMap<string, ModelSurfaceKind>): ModelFrameScope {
  const {actors} = value.actors;
  const takes = new Map(actors.filter(modelActorDrawsFile).map(actor => [actor.id,
    modelRuntimeAssetProfile(actor) ?? modelSurfaceTakes(actor.surfaces, value.surfaceSets, kinds)]));
  const scope: ModelFrameScope = Object.freeze({actors, takes});
  scopeKeys.set(scope, modelRecordIdentity({
    actors: actors.map(actor => modelActorDrawsFile(actor) ? [actor.id, actor.asset.id] : [actor.id]),
    takes: [...takes.entries()].map(([id, take]) => [id, 'surfaces' in take ? [...take.surfaces.entries()] : take]),
  }));
  return scope;
}

const FRAME_CAMERA_WHERE = modelPreviewCameraWhere('Frame camera');
const frameCameraScratch = new Float64Array(CAMERA_COORDS.length);

function checkFrameEntities(rawEntities: readonly unknown[], scope: ModelFrameScope): ModelPreviewEntity[] {
  const declared = new Map(scope.actors.map(entry => [entry.id, entry])), seen = new Set<string>();
  return Array.from(rawEntities, (entity: unknown) => {
    const id = object(entity) ? entity.entityId : undefined;
    if (!named(id)) throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.entity);
    const actor = declared.get(id);
    if (!actor) throw new ModelStageRefusal(refusal.undeclared(id));
    if (seen.has(id)) throw new ModelStageRefusal(refusal.twice(id));
    if (!modelActorDrawsFile(actor)) throw new ModelStageRefusal(refusal.terrainFrame(id));
    seen.add(id);
    return modelPreviewEntity(entity, actor.asset.id, scope.takes.get(id));
  });
}

/** Validates an optional frame camera into `into` (`CAMERA_COORDS`), returning whether `camera` was stated. */
export function readModelFrameCamera(record: Record<string, unknown>, into: Float64Array): boolean {
  if (!modelStates(record, 'camera')) return false;
  const {camera} = record;
  modelRecordStating(camera, MODEL_PREVIEW_CAMERA_FIELDS, FRAME_CAMERA_WHERE.camera);
  readModelPreviewCamera(camera, FRAME_CAMERA_WHERE, into);
  return true;
}

/** The one validator of an engine frame against `scope`, reusing a record already validated against the same scope. */
export function validateModelFrame(value: unknown, scope: ModelFrameScope,
  cameraInto: Float64Array): ModelValidatedFrame {
  const scopeKey = scopeKeys.get(scope);
  const held = typeof value === 'object' && value !== null ? validatedFrames.get(value) : undefined;
  if (held !== undefined) {
    if (scopeKey !== undefined && held.scopeKey === scopeKey) return held.frame;
    const entities = checkFrameEntities(held.frame.entities, scope);
    return Object.freeze({simulationTimeSeconds: held.frame.simulationTimeSeconds,
      entities: Object.freeze(entities), cameraCoordinates: held.frame.cameraCoordinates});
  }
  const time = object(value) ? value.simulationTimeSeconds : undefined;
  const rawEntities = object(value) ? value.entities : undefined;
  if (!object(value) || typeof time !== 'number' || !Number.isFinite(time) || time < 0 ||
    !Array.isArray(rawEntities)) {
    throw new ModelStageRefusal(refusal.frame);
  }
  if (value.removedEntities !== undefined &&
    (!Array.isArray(value.removedEntities) || value.removedEntities.length)) {
    throw new ModelStageRefusal(refusal.removed);
  }
  const entities = checkFrameEntities(rawEntities, scope);
  const hasCamera = readModelFrameCamera(value, cameraInto);
  const frame: ModelValidatedFrame = Object.freeze({simulationTimeSeconds: time,
    entities: Object.freeze(entities), cameraCoordinates: hasCamera ? cameraInto : null});
  if (scopeKey !== undefined) validatedFrames.set(frame, {frame, scopeKey});
  return frame;
}

/**
 * One engine frame, checked against the description in force before anything applies it. Its own record is written
 * out here rather than through the record owner (recordModel.ts): it is the engine's per-tick presentation frame, which
 * carries fields of its own beyond the stage's (an entity's instance and session, the frame's tick) that the stage
 * neither reads nor refuses, and `removedEntities` is the engine's to state or leave out. What the stage does read is
 * checked whole: an entity by `modelPreviewEntity`, its pose and camera by the record owner.
 */
export function modelPreviewFrame(value: unknown, scope: ModelFrameScope): ModelPreviewFrame {
  const checked = validateModelFrame(value, scope, frameCameraScratch);
  if (checked.cameraCoordinates === null) {
    return Object.freeze({simulationTimeSeconds: checked.simulationTimeSeconds, entities: checked.entities});
  }
  const camera = freezeModelPreviewCamera(checked.cameraCoordinates);
  return Object.freeze({simulationTimeSeconds: checked.simulationTimeSeconds, entities: checked.entities, camera});
}
