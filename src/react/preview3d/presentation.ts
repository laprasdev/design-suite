import type {ModelRotation, ModelVector} from './model.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelMaterialOutputs} from './runtimeMaterialModel.ts';
import type {ModelMaterialOutput, ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelAnimationLayers} from './animationLayerModel.ts';
import type {ModelAnimationLayer} from './animationLayerModel.ts';

export const MODEL_PREVIEW_QUATERNION_TOLERANCE = 1e-4;
export const MODEL_PREVIEW_ENTITY_REFUSAL = Object.freeze({entity: 'Every frame entity requires an entityId.'});
export const MODEL_PREVIEW_CAPABILITIES = Object.freeze({
  pose: true, animationLayers: true, partPoses: false, materials: false,
});
export interface ModelPresentationPose {
  readonly position: ModelVector;
  readonly rotationQuaternion: ModelRotation;
  readonly scale: ModelVector;
}
// One entity of an engine frame: the actor it names and every channel the engine published for it.
export interface ModelPreviewEntity {
  readonly entityId: string;
  readonly modelId: string;
  readonly pose: ModelPresentationPose;
  readonly animationLayers: readonly ModelAnimationLayer[];
  readonly partPoses: readonly unknown[];
  readonly materials: readonly ModelMaterialOutput[];
}
export interface ModelPoseBinding {
  readonly reflectZ: boolean;
  readonly rotationQuaternion: ModelRotation;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function numbers(value: unknown, count: number, name: string): number[] {
  const copy = Array.isArray(value) ? Array.from(value) : [];
  if (copy.length !== count || !copy.every(Number.isFinite)) {
    throw new ModelStageRefusal(`${name} must contain ${count} finite numbers.`);
  }
  return copy;
}
export function modelPresentationVector(value: unknown, name: string): ModelVector {
  const copy = numbers(value, 3, name);
  return Object.freeze([copy[0], copy[1], copy[2]]);
}
export function modelPresentationRotation(value: unknown): ModelRotation {
  const copy = numbers(value, 4, 'rotationQuaternion');
  if (Math.abs(Math.hypot(...copy) - 1) > MODEL_PREVIEW_QUATERNION_TOLERANCE) {
    throw new ModelStageRefusal('rotationQuaternion must have unit length.');
  }
  return Object.freeze([copy[0], copy[1], copy[2], copy[3]]);
}
function pose(value: unknown): ModelPresentationPose {
  if (!object(value)) throw new ModelStageRefusal('A full model pose is required.');
  return Object.freeze({position: modelPresentationVector(value.position, 'position'),
    rotationQuaternion: modelPresentationRotation(value.rotationQuaternion),
    scale: modelPresentationVector(value.scale, 'scale')});
}

// Validate every channel before any pose is applied; refusals name the entity. Accepted values never retain
// caller-owned arrays.
export function modelPreviewEntity(value: unknown, modelId: string,
  materials?: ModelRuntimeMaterialProfile): ModelPreviewEntity {
  if (!object(value) || typeof value.entityId !== 'string' || !value.entityId) {
    throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.entity);
  }
  if (typeof value.modelId !== 'string' || value.modelId !== modelId) {
    throw new ModelStageRefusal(`Entity ${value.entityId}: modelId must match the declared model ${modelId}.`);
  }
  if (!Array.isArray(value.partPoses) || value.partPoses.length !== 0) {
    throw new ModelStageRefusal('partPoses must be an explicitly empty array for this preview.');
  }
  return Object.freeze({entityId: value.entityId, modelId: value.modelId, pose: pose(value.pose),
    animationLayers: modelAnimationLayers(value.animationLayers, value.entityId), partPoses: Object.freeze([]),
    materials: modelMaterialOutputs(value.materials, materials)});
}

export function modelPreviewCamera(value: unknown) {
  if (!object(value)) throw new ModelStageRefusal('A complete preview camera is required.');
  const position = modelPresentationVector(value.position, 'camera position');
  const target = modelPresentationVector(value.target, 'camera target');
  const distance = Math.hypot(...position.map((component, index) => component - target[index]));
  if (!(distance > 0) || !Number.isFinite(distance)) {
    throw new ModelStageRefusal('Camera position and target must be distinct.');
  }
  return Object.freeze({position, target});
}

// Position is in metres. Reflect the coordinate basis, then postmultiply the local model alignment.
export function modelPoseForBinding(value: ModelPresentationPose, binding: ModelPoseBinding): ModelPresentationPose {
  const source = pose(value);
  if (!object(binding) || typeof binding.reflectZ !== 'boolean') {
    throw new ModelStageRefusal('A pose binding is required.');
  }
  const [bx, by, bz, bw] = modelPresentationRotation(binding.rotationQuaternion);
  const [x, y, z, aw] = source.rotationQuaternion;
  const ax = binding.reflectZ ? -x : x, ay = binding.reflectZ ? -y : y, az = z;
  const result = [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz];
  const length = Math.hypot(...result);
  return Object.freeze({
    position: Object.freeze([source.position[0], source.position[1], binding.reflectZ ? -source.position[2] :
      source.position[2]]) as ModelVector,
    rotationQuaternion: Object.freeze(result.map(component => component / length)) as unknown as ModelRotation,
    scale: source.scale,
  });
}
