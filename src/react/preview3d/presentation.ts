import type {ModelRotation, ModelVector} from './model.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelMaterialOutputs, modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import type {ModelMaterialOutput, ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelAnimationLayers} from './animationLayerModel.ts';
import type {ModelAnimationLayer} from './animationLayerModel.ts';

export const MODEL_PREVIEW_QUATERNION_TOLERANCE = 1e-4;
export const MODEL_PREVIEW_CAPABILITIES = Object.freeze({
  pose: true, animationLayers: true, partPoses: false, materials: false,
});
export interface ModelPresentationPose {
  readonly position: ModelVector;
  readonly rotationQuaternion: ModelRotation;
  readonly scale: ModelVector;
}
export interface ModelPreviewPresentation {
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
export type ModelPresentationStatus = 'waiting' | 'pending' | 'ready' | 'error';
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

// Validate every channel before any pose is applied. Accepted values never retain caller-owned arrays.
export function modelPreviewPresentation(value: unknown, selectedId: string,
  materials?: ModelRuntimeMaterialProfile, owner?: string): ModelPreviewPresentation {
  if (!object(value) || typeof value.modelId !== 'string' || value.modelId !== selectedId) {
    throw new ModelStageRefusal('Runtime modelId must match the selected model.');
  }
  if (!Array.isArray(value.partPoses) || value.partPoses.length !== 0) {
    throw new ModelStageRefusal('partPoses must be an explicitly empty array for this preview.');
  }
  return Object.freeze({modelId: value.modelId, pose: pose(value.pose),
    animationLayers: modelAnimationLayers(value.animationLayers, owner ?? selectedId), partPoses: Object.freeze([]),
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

// A loaded instance consumes only its latest validated input; publication/session policy belongs to its host.
export function createModelPresentationInbox(modelId: string, materials?: ModelRuntimeMaterialProfile) {
  let profile: ModelRuntimeMaterialProfile | undefined, invalidProfile: unknown;
  try {profile = materials ? modelRuntimeMaterialProfile(materials) : undefined;}
  catch (error) {invalidProfile = error;}
  let pending: ModelPreviewPresentation | null = null;
  let apply: ((value: ModelPreviewPresentation) => void) | null = null;
  let status: ModelPresentationStatus = 'waiting';
  // What failed while the status is 'error', for the host to read by its kind; cleared by the next accepted one.
  let failure: unknown;
  const refuse = (error: unknown) => {
    pending = null; status = 'error'; failure = error;
    return status;
  };
  const applyPending = () => {
    if (!pending) return status;
    try {
      apply?.(pending);
      status = apply ? 'ready' : 'pending';
      failure = undefined;
    } catch (error) {refuse(error);}
    return status;
  };
  return {
    get status() {return status;},
    get failure() {return failure;},
    receive(value: unknown): ModelPresentationStatus {
      if (invalidProfile !== undefined) return refuse(invalidProfile);
      if (value === null) {pending = null; status = 'waiting'; failure = undefined; return status;}
      try {pending = modelPreviewPresentation(value, modelId, profile);}
      catch (error) {return refuse(error);}
      return applyPending();
    },
    attach(consume: (value: ModelPreviewPresentation) => void) {apply = consume; return applyPending();},
    detach() {apply = null; if (pending) status = 'pending';},
    clear() {pending = null; apply = null; status = 'waiting'; failure = undefined;},
  };
}
