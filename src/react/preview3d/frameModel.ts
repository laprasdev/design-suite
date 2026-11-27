import type {ModelStageActor, ModelStageActorSet} from './actorModel.ts';
import {MODEL_ACTOR_REFUSAL as refusal, modelActorDrawsFile} from './actorModel.ts';
import {modelRuntimeAssetProfile} from './actorAssetModel.ts';
import {CAMERA_COORDS, freezeModelPreviewCamera, MODEL_PREVIEW_CAMERA_FIELDS, MODEL_PREVIEW_ENTITY_REFUSAL,
  modelPreviewCameraWhere, modelPreviewEntity, readModelPreviewCamera,
  type ModelPreviewCamera, type ModelPreviewEntity} from './presentation.ts';
import {isFiniteNumber, isNonEmptyString as named, isRecord as object} from '../../valueChecks.ts';
import {modelRecordStating, modelStates, readModelNumbers} from './recordModel.ts';
import {MODEL_VECTOR_AXES, type ModelVector} from './placementModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelSurfaceSet} from './surfaceModel.ts';
import {modelSurfaceTakes, type ModelSurfaceTakes} from './surfaceOutputModel.ts';
import type {ModelSurfaceKind} from './surfaceKindModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';

const VALIDATED_FRAME: unique symbol = Symbol('ModelValidatedFrame');

// An engine frame as the stage takes it: what it is checked against (the description in force), and the check.
// The stage's own frame, built by the host: every entity names a declared actor, so an unknown id is refused.
export interface ModelPreviewFrame {
  readonly simulationTimeSeconds: number;
  readonly entities: readonly ModelPreviewEntity[];
  readonly camera?: ModelPreviewCamera;
  readonly gravity?: ModelVector;
}
/** A validated frame produced only by `validateModelFrame`, ready to apply without re-reading or freezing a camera. */
export interface ModelValidatedFrame {
  readonly [VALIDATED_FRAME]: true;
  readonly simulationTimeSeconds: number;
  readonly entities: readonly ModelPreviewEntity[];
  readonly cameraCoordinates: Float64Array | null;
  /** The scene's gravity the frame states, in its holder's buffer (sceneGravity.ts keeps it once applied), or none. */
  readonly gravity: Float64Array | null;
}
/** What validating a frame writes into, owned by whoever holds the validated frame until it applies (the inbox): the
 * camera's coordinates (`CAMERA_COORDS`) and the scene's gravity, copied so that a sender writing into its own arrays
 * after validation changes nothing held. */
export interface ModelFrameBuffers {
  readonly camera: Float64Array;
  readonly gravity: Float64Array;
}
export const createModelFrameBuffers = (): ModelFrameBuffers => Object.freeze({
  camera: new Float64Array(CAMERA_COORDS.length), gravity: new Float64Array(MODEL_VECTOR_AXES)});
/** What a frame is checked against: the declared actors and, by actor id, what each one's renderers take. */
export interface ModelFrameScope {
  readonly actors: readonly ModelStageActor[];
  readonly takes: ReadonlyMap<string, ModelRuntimeMaterialProfile | ModelSurfaceTakes>;
}

export const isModelValidatedFrame = (value: unknown): value is ModelValidatedFrame =>
  typeof value === 'object' && value !== null && VALIDATED_FRAME in value && value[VALIDATED_FRAME] === true;

/** A description's frame scope, made once when it is applied: an actor with a runtime profile takes through it (the
 * description refuses one with a set too), every other one through its surfaces. */
export function modelFrameScope(value: {readonly actors: ModelStageActorSet;
  readonly surfaceSets: Readonly<Record<string, ModelSurfaceSet>>},
kinds: ReadonlyMap<string, ModelSurfaceKind>): ModelFrameScope {
  const {actors} = value.actors;
  return Object.freeze({actors, takes: new Map(actors.filter(modelActorDrawsFile).map(actor => [actor.id,
    modelRuntimeAssetProfile(actor) ?? modelSurfaceTakes(actor.surfaces, value.surfaceSets, kinds)]))});
}

const FRAME_CAMERA_WHERE = modelPreviewCameraWhere('Frame camera');
const frameScratch = createModelFrameBuffers();

/** Validates an optional frame camera into `into` (`CAMERA_COORDS`), returning whether `camera` was stated. */
export function readModelFrameCamera(record: Record<string, unknown>, into: Float64Array): boolean {
  if (!modelStates(record, 'camera')) return false;
  const {camera} = record;
  modelRecordStating(camera, MODEL_PREVIEW_CAMERA_FIELDS, FRAME_CAMERA_WHERE.camera);
  readModelPreviewCamera(camera, FRAME_CAMERA_WHERE, into);
  return true;
}

const FRAME_GRAVITY_WHERE = 'Frame gravity';
// The scene's gravity, a scene fact the frame states as it states the scene's camera: metres a second squared in world
// space, validated into `into`, returning whether `gravity` was stated.
function readModelFrameGravity(record: Record<string, unknown>, into: Float64Array): boolean {
  if (!modelStates(record, 'gravity')) return false;
  readModelNumbers(record.gravity, MODEL_VECTOR_AXES, into, 0, FRAME_GRAVITY_WHERE);
  return true;
}

/** The one validator of an engine frame against `scope`, writing its optional camera and gravity into `into`. */
export function validateModelFrame(value: unknown, scope: ModelFrameScope,
  into: ModelFrameBuffers): ModelValidatedFrame {
  const time = object(value) ? value.simulationTimeSeconds : undefined;
  const rawEntities = object(value) ? value.entities : undefined;
  if (!object(value) || !isFiniteNumber(time) || time < 0 ||
    !Array.isArray(rawEntities)) {
    throw new ModelStageRefusal(refusal.frame);
  }
  if (value.removedEntities !== undefined &&
    (!Array.isArray(value.removedEntities) || value.removedEntities.length)) {
    throw new ModelStageRefusal(refusal.removed);
  }
  const declared = new Map(scope.actors.map(entry => [entry.id, entry])), seen = new Set<string>();
  const entities = Array.from(rawEntities, (entity: unknown) => {
    const id = object(entity) ? entity.entityId : undefined;
    if (!named(id)) throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.entity);
    const actor = declared.get(id);
    if (!actor) throw new ModelStageRefusal(refusal.undeclared(id));
    if (seen.has(id)) throw new ModelStageRefusal(refusal.twice(id));
    if (!modelActorDrawsFile(actor)) throw new ModelStageRefusal(refusal.terrainFrame(id));
    seen.add(id);
    return modelPreviewEntity(entity, actor.asset.id, scope.takes.get(id));
  });
  const hasCamera = readModelFrameCamera(value, into.camera), hasGravity = readModelFrameGravity(value, into.gravity);
  const checked: ModelValidatedFrame = {
    [VALIDATED_FRAME]: true,
    simulationTimeSeconds: time,
    entities: Object.freeze(entities),
    cameraCoordinates: hasCamera ? into.camera : null,
    gravity: hasGravity ? into.gravity : null,
  };
  return Object.freeze(checked);
}

/**
 * One engine frame, checked against the description in force before anything applies it. Its own record is written
 * out here rather than through the record owner (recordModel.ts): it is the engine's per-tick presentation frame, which
 * carries fields of its own beyond the stage's (an entity's instance and session, the frame's tick) that the stage
 * neither reads nor refuses, and `removedEntities` is the engine's to state or leave out. What the stage does read is
 * checked whole: an entity by `modelPreviewEntity`, its pose and camera by the record owner.
 */
export function modelPreviewFrame(value: unknown, scope: ModelFrameScope): ModelPreviewFrame {
  const {simulationTimeSeconds, entities, cameraCoordinates, gravity} =
    validateModelFrame(value, scope, frameScratch);
  return Object.freeze({simulationTimeSeconds, entities,
    ...cameraCoordinates === null ? {} : {camera: freezeModelPreviewCamera(cameraCoordinates)},
    ...gravity === null ? {} : {gravity: Object.freeze([gravity[0], gravity[1], gravity[2]] as const)}});
}
