import {modelPresentationPose, type ModelPresentationPose, type ModelVector}
  from './placementModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {isRecord as object} from '../../valueChecks.ts';
import {MODEL_RECORD_REFUSAL, modelStates} from './recordModel.ts';
import {modelMaterialOutputs} from './runtimeMaterialModel.ts';
import type {ModelMaterialOutput, ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelSurfaceOutputs, type ModelSurfaceTakes} from './surfaceOutputModel.ts';
import {modelAnimationLayers} from './animationLayerModel.ts';
import type {ModelAnimationLayer} from './animationLayerModel.ts';

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
export const CAMERA_COORDS = Object.freeze({
  px: 0, py: 1, pz: 2, tx: 3, ty: 4, tz: 5, fov: 6, length: 7,
} as const);
export const MODEL_PREVIEW_CAMERA_REFUSAL = Object.freeze({
  camera: (where: string) => `${where} requires position and target.`,
  distinct: (where: string) => `${where}: position and target must be distinct.`,
  fieldOfView: (where: string) => `${where}.fieldOfView must be a finite number strictly between 0 and 180.`,
});

function readVector3(value: unknown, into: Float64Array, offset: number, where: string) {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.numbers(where, 3));
  }
  for (let index = 0; index < 3; index++) {
    if (!(index in value) || typeof value[index] !== 'number' || !Number.isFinite(value[index])) {
      throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.numbers(where, 3));
    }
    into[offset + index] = value[index];
  }
}

function hypot3(x: number, y: number, z: number): number {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  const max = ax > ay ? (ax > az ? ax : az) : (ay > az ? ay : az);
  if (max === 0 || !Number.isFinite(max)) return max;
  const sx = x / max, sy = y / max, sz = z / max;
  return max * Math.sqrt(sx * sx + sy * sy + sz * sz);
}

/** Validates a camera into `into` (`CAMERA_COORDS`), returning whether `fieldOfView` was stated; allocates nothing. */
export function readModelPreviewCamera(value: unknown, where: string, into: Float64Array): boolean {
  if (!object(value)) throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.camera(where));
  readVector3(value.position, into, CAMERA_COORDS.px, `${where}.position`);
  readVector3(value.target, into, CAMERA_COORDS.tx, `${where}.target`);
  const distance = hypot3(
    into[CAMERA_COORDS.px] - into[CAMERA_COORDS.tx],
    into[CAMERA_COORDS.py] - into[CAMERA_COORDS.ty],
    into[CAMERA_COORDS.pz] - into[CAMERA_COORDS.tz],
  );
  if (!(distance > 0) || !Number.isFinite(distance)) {
    throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.distinct(where));
  }
  if (!modelStates(value, 'fieldOfView')) return false;
  const {fieldOfView} = value;
  if (typeof fieldOfView !== 'number' || !Number.isFinite(fieldOfView) || fieldOfView <= 0 || fieldOfView >= 180) {
    throw new ModelStageRefusal(MODEL_PREVIEW_CAMERA_REFUSAL.fieldOfView(where));
  }
  into[CAMERA_COORDS.fov] = fieldOfView;
  return true;
}

const cameraScratch = new Float64Array(CAMERA_COORDS.length);
export function modelPreviewCamera(value: unknown, where: string): ModelPreviewCamera {
  const hasFov = readModelPreviewCamera(value, where, cameraScratch);
  const position: ModelVector = Object.freeze([
    cameraScratch[CAMERA_COORDS.px], cameraScratch[CAMERA_COORDS.py], cameraScratch[CAMERA_COORDS.pz],
  ]);
  const target: ModelVector = Object.freeze([
    cameraScratch[CAMERA_COORDS.tx], cameraScratch[CAMERA_COORDS.ty], cameraScratch[CAMERA_COORDS.tz],
  ]);
  return hasFov ? Object.freeze({position, target, fieldOfView: cameraScratch[CAMERA_COORDS.fov]}) :
    Object.freeze({position, target});
}
