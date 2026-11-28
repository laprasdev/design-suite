import {modelPresentationPose, type ModelPresentationPose, type ModelVector}
  from './placementModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {isFiniteNumber, isRecord as object} from '../../valueChecks.ts';
import {modelStates, readModelNumbers, type ModelStatingFields} from './recordModel.ts';
import {modelMaterialOutputs} from './runtimeMaterialModel.ts';
import type {ModelMaterialOutput, ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelSurfaceOutputs, type ModelSurfaceTakes} from './surfaceOutputModel.ts';
import {modelAnimationLayers} from './animationLayerModel.ts';
import type {ModelAnimationLayer} from './animationLayerModel.ts';
import {MODEL_NO_EMITTER_CHANGES, modelEmitterChanges, type ModelEmitterChange} from './emitterFrameModel.ts';
import {modelGroundPresser, type ModelGroundPresser} from './groundPressers.ts';

export const MODEL_STAGE_FIELD_OF_VIEW = 38;
/** How near the camera the stage draws, the plane every look's far plane lies beyond. */
export const MODEL_STAGE_NEAR_PLANE = 0.01;
export const MODEL_PREVIEW_ENTITY_REFUSAL = Object.freeze({
  entity: 'Every frame entity requires an entityId.',
  model: (id: string, expected: string) => `Entity ${id}: modelId must match the declared model ${expected}.`,
});
export const MODEL_PREVIEW_CAPABILITIES = Object.freeze({
  pose: true, animationLayers: true, partPoses: false, materials: false, emitters: true,
});
// One entity of an engine frame: the actor it names and every channel the engine published for it.
export interface ModelPreviewEntity {
  readonly entityId: string;
  readonly modelId: string;
  readonly pose: ModelPresentationPose;
  readonly animationLayers: readonly ModelAnimationLayer[];
  readonly partPoses: readonly unknown[];
  readonly materials: readonly ModelMaterialOutput[];
  /** The emitter changes of this tick, in order; the engine states `emitters` only on a tick with one. */
  readonly emitters: readonly ModelEmitterChange[];
  /** What it presses the ground with at its pose position; null for an entity that states no `presser`. */
  readonly presser: ModelGroundPresser | null;
}

// Validate every channel before any pose is applied; refusals name the entity. Accepted values never retain
// caller-owned arrays. `materials` is what the actor's renderers take: the runtime profile's renderers (until that
// route leaves, step 5e), or its surfaces' renderers; with neither, the frame states no material.
export function modelPreviewEntity(value: unknown, modelId: string,
  materials?: ModelRuntimeMaterialProfile | ModelSurfaceTakes): ModelPreviewEntity {
  if (!object(value) || typeof value.entityId !== 'string' || !value.entityId) {
    throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.entity);
  }
  if (typeof value.modelId !== 'string' || value.modelId !== modelId) {
    throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.model(value.entityId, modelId));
  }
  if (!Array.isArray(value.partPoses) || value.partPoses.length !== 0) {
    throw new ModelStageRefusal('partPoses must be an explicitly empty array for this preview.');
  }
  return Object.freeze({entityId: value.entityId, modelId: value.modelId,
    pose: modelPresentationPose(value.pose, `Entity ${value.entityId} pose`),
    animationLayers: modelAnimationLayers(value.animationLayers, value.entityId), partPoses: Object.freeze([]),
    materials: materials !== undefined && 'surfaces' in materials ?
      modelSurfaceOutputs(value.materials, materials, `Entity ${value.entityId}`) :
      modelMaterialOutputs(value.materials, materials),
    emitters: modelStates(value, 'emitters') ?
      modelEmitterChanges(value.emitters, value.entityId) : MODEL_NO_EMITTER_CHANGES,
    // An accepted entity states its absent presser as null, and a frame of accepted entities must read again.
    presser: modelStates(value, 'presser') && value.presser !== null ?
      modelGroundPresser(value.presser, `Entity ${value.entityId} presser`) : null});
}

/** A camera pose: eye position, look-at target, and optional vertical field of view in degrees within (0, 180). */
export interface ModelPreviewCamera {
  readonly position: ModelVector;
  readonly target: ModelVector;
  readonly fieldOfView?: number;
}
export const MODEL_PREVIEW_CAMERA_FIELDS: ModelStatingFields = Object.freeze({
  stated: Object.freeze(['position', 'target']),
  whenStated: Object.freeze(['fieldOfView']),
});
export interface ModelPreviewCameraWhere {
  readonly camera: string;
  readonly position: string;
  readonly target: string;
}
export const modelPreviewCameraWhere = (camera: string): ModelPreviewCameraWhere =>
  Object.freeze({camera, position: `${camera}.position`, target: `${camera}.target`});
export const CAMERA_COORDS = Object.freeze({
  px: 0, py: 1, pz: 2, tx: 3, ty: 4, tz: 5, fov: 6, length: 7,
} as const);
export const UNSTATED_FIELD_OF_VIEW = Number.NaN;
export const cameraStatesFieldOfView = (coords: Float64Array): boolean =>
  !Number.isNaN(coords[CAMERA_COORDS.fov]);
export const MODEL_PREVIEW_CAMERA_REFUSAL = Object.freeze({
  camera: (where: string) => `${where} requires position and target.`,
  distinct: (where: string) => `${where}: position and target must be distinct.`,
  fieldOfView: (where: string) => `${where}.fieldOfView must be a finite number strictly between 0 and 180.`,
});

/** Validates a camera into `into` (`CAMERA_COORDS`), storing `UNSTATED_FIELD_OF_VIEW` when `fieldOfView` is unstated.
 * Makes no object, array or string on valid input. */
export function readModelPreviewCamera(value: unknown, where: ModelPreviewCameraWhere, into: Float64Array): void {
  if (!object(value)) throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.camera(where.camera));
  readModelNumbers(value.position, 3, into, CAMERA_COORDS.px, where.position);
  readModelNumbers(value.target, 3, into, CAMERA_COORDS.tx, where.target);
  const dx = into[CAMERA_COORDS.px] - into[CAMERA_COORDS.tx];
  const dy = into[CAMERA_COORDS.py] - into[CAMERA_COORDS.ty];
  const dz = into[CAMERA_COORDS.pz] - into[CAMERA_COORDS.tz];
  const distanceSquared = dx * dx + dy * dy + dz * dz;
  if (!(distanceSquared > 0) || !Number.isFinite(distanceSquared)) {
    throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.distinct(where.camera));
  }
  if (!modelStates(value, 'fieldOfView')) {
    into[CAMERA_COORDS.fov] = UNSTATED_FIELD_OF_VIEW;
    return;
  }
  const {fieldOfView} = value;
  if (!isFiniteNumber(fieldOfView) || fieldOfView <= 0 || fieldOfView >= 180) {
    throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.fieldOfView(where.camera));
  }
  into[CAMERA_COORDS.fov] = fieldOfView;
}

export function freezeModelPreviewCamera(coords: Float64Array): ModelPreviewCamera {
  const position: ModelVector = Object.freeze([
    coords[CAMERA_COORDS.px], coords[CAMERA_COORDS.py], coords[CAMERA_COORDS.pz],
  ]);
  const target: ModelVector = Object.freeze([
    coords[CAMERA_COORDS.tx], coords[CAMERA_COORDS.ty], coords[CAMERA_COORDS.tz],
  ]);
  return cameraStatesFieldOfView(coords) ? Object.freeze({position, target, fieldOfView: coords[CAMERA_COORDS.fov]}) :
    Object.freeze({position, target});
}

const cameraScratch = new Float64Array(CAMERA_COORDS.length);
export function modelPreviewCamera(value: unknown, where: string): ModelPreviewCamera {
  readModelPreviewCamera(value, modelPreviewCameraWhere(where), cameraScratch);
  return freezeModelPreviewCamera(cameraScratch);
}
