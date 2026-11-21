import {modelPresentationPose, type ModelPresentationPose, type ModelVector}
  from './placementModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {isRecord as object} from '../../valueChecks.ts';
import {modelStates, readModelNumbers, type ModelStatingFields} from './recordModel.ts';
import {modelMaterialOutputs} from './runtimeMaterialModel.ts';
import type {ModelMaterialOutput, ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelSurfaceOutputs, type ModelSurfaceTakes} from './surfaceOutputModel.ts';
import {modelAnimationLayers} from './animationLayerModel.ts';
import type {ModelAnimationLayer} from './animationLayerModel.ts';

export const MODEL_STAGE_FIELD_OF_VIEW = 38;
export const MODEL_PREVIEW_ENTITY_REFUSAL = Object.freeze({entity: 'Every frame entity requires an entityId.'});
export const MODEL_PREVIEW_CAPABILITIES = Object.freeze({
  pose: true, animationLayers: true, partPoses: false, materials: false,
});
// One entity of an engine frame: the actor it names and every channel the engine published for it.
export interface ModelPreviewEntity {
  readonly entityId: string;
  readonly modelId: string;
  readonly pose: ModelPresentationPose;
  readonly animationLayers: readonly ModelAnimationLayer[];
  readonly partPoses: readonly unknown[];
  readonly materials: readonly ModelMaterialOutput[];
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
    throw new ModelStageRefusal(`Entity ${value.entityId}: modelId must match the declared model ${modelId}.`);
  }
  if (!Array.isArray(value.partPoses) || value.partPoses.length !== 0) {
    throw new ModelStageRefusal('partPoses must be an explicitly empty array for this preview.');
  }
  return Object.freeze({entityId: value.entityId, modelId: value.modelId,
    pose: modelPresentationPose(value.pose, `Entity ${value.entityId} pose`),
    animationLayers: modelAnimationLayers(value.animationLayers, value.entityId), partPoses: Object.freeze([]),
    materials: materials !== undefined && 'surfaces' in materials ?
      modelSurfaceOutputs(value.materials, materials, `Entity ${value.entityId}`) :
      modelMaterialOutputs(value.materials, materials)});
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
export const MODEL_PREVIEW_CAMERA_REFUSAL = Object.freeze({
  camera: (where: string) => `${where} requires position and target.`,
  distinct: (where: string) => `${where}: position and target must be distinct.`,
  fieldOfView: (where: string) => `${where}.fieldOfView must be a finite number strictly between 0 and 180.`,
});

/** Validates a camera into `into` (`CAMERA_COORDS`), writing `MODEL_STAGE_FIELD_OF_VIEW` when `fieldOfView` is unstated
 * and returning whether `fieldOfView` was stated. Makes no object, array or string on valid input. */
export function readModelPreviewCamera(value: unknown, where: ModelPreviewCameraWhere, into: Float64Array): boolean {
  if (!object(value)) throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.camera(where.camera));
  readModelNumbers(value.position, 3, into, CAMERA_COORDS.px, where.position);
  readModelNumbers(value.target, 3, into, CAMERA_COORDS.tx, where.target);
  const distance = Math.hypot(
    into[CAMERA_COORDS.px] - into[CAMERA_COORDS.tx],
    into[CAMERA_COORDS.py] - into[CAMERA_COORDS.ty],
    into[CAMERA_COORDS.pz] - into[CAMERA_COORDS.tz],
  );
  if (!(distance > 0) || !Number.isFinite(distance)) {
    throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.distinct(where.camera));
  }
  if (!modelStates(value, 'fieldOfView')) {
    into[CAMERA_COORDS.fov] = MODEL_STAGE_FIELD_OF_VIEW;
    return false;
  }
  const {fieldOfView} = value;
  if (typeof fieldOfView !== 'number' || !Number.isFinite(fieldOfView) || fieldOfView <= 0 || fieldOfView >= 180) {
    throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.fieldOfView(where.camera));
  }
  into[CAMERA_COORDS.fov] = fieldOfView;
  return true;
}

export function freezeModelPreviewCamera(coords: Float64Array, hasFieldOfView: boolean): ModelPreviewCamera {
  const position: ModelVector = Object.freeze([
    coords[CAMERA_COORDS.px], coords[CAMERA_COORDS.py], coords[CAMERA_COORDS.pz],
  ]);
  const target: ModelVector = Object.freeze([
    coords[CAMERA_COORDS.tx], coords[CAMERA_COORDS.ty], coords[CAMERA_COORDS.tz],
  ]);
  return hasFieldOfView ? Object.freeze({position, target, fieldOfView: coords[CAMERA_COORDS.fov]}) :
    Object.freeze({position, target});
}

const cameraScratch = new Float64Array(CAMERA_COORDS.length);
export function modelPreviewCamera(value: unknown, where: string): ModelPreviewCamera {
  const hasFov = readModelPreviewCamera(value, modelPreviewCameraWhere(where), cameraScratch);
  return freezeModelPreviewCamera(cameraScratch, hasFov);
}
