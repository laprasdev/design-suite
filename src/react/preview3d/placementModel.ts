import {ModelStageRefusal} from './refusal.ts';
import {isRecord as object} from '../../valueChecks.ts';
import {modelFlag, modelNumbers, modelRecord} from './recordModel.ts';

// The stage's placement data, with no renderer: vectors, unit rotations and whole poses, their validators and the one
// coordinate adapter. Every other preview file reaches these through here, so none of them imports another for them.
export type ModelVector = readonly [number, number, number];
export type ModelRotation = readonly [number, number, number, number];
export const MODEL_PREVIEW_QUATERNION_TOLERANCE = 1e-4;
// A pose is whole: every component is stated, so no component is ever taken from an earlier pose or an identity.
export const MODEL_POSE_COMPONENTS = Object.freeze(['position', 'rotationQuaternion', 'scale'] as const);
export const MODEL_POSE_REFUSAL = Object.freeze({
  unit: (where: string) => `${where} must have unit length.`,
  binding: 'The pose binding is a record of reflectZ and rotationQuaternion.',
});
export interface ModelPresentationPose {
  readonly position: ModelVector;
  readonly rotationQuaternion: ModelRotation;
  readonly scale: ModelVector;
}
export interface ModelPoseBinding {
  readonly reflectZ: boolean;
  readonly rotationQuaternion: ModelRotation;
}
const MODEL_POSE_BINDING_OWNER = 'The pose to bind';
export function modelPresentationVector(value: unknown, name: string): ModelVector {
  const copy = modelNumbers(value, 3, name);
  return Object.freeze([copy[0], copy[1], copy[2]]);
}
/** A unit quaternion; `where` names it in a refusal. */
export function modelPresentationRotation(value: unknown, where: string): ModelRotation {
  const copy = modelNumbers(value, 4, where);
  if (Math.abs(Math.hypot(...copy) - 1) > MODEL_PREVIEW_QUATERNION_TOLERANCE) {
    throw new ModelStageRefusal(MODEL_POSE_REFUSAL.unit(where));
  }
  return Object.freeze([copy[0], copy[1], copy[2], copy[3]]);
}
/**
 * A whole pose, exactly its three components; `where` names the pose (`Entity a pose`). Checked on every tick an
 * engine frame arrives, so it builds no text unless it refuses: a component is named by its own name.
 */
export function modelPresentationPose(value: unknown, where: string): ModelPresentationPose {
  const pose = modelRecord(value, MODEL_POSE_COMPONENTS, where);
  return Object.freeze({position: modelPresentationVector(pose.position, MODEL_POSE_COMPONENTS[0]),
    rotationQuaternion: modelPresentationRotation(pose.rotationQuaternion, MODEL_POSE_COMPONENTS[1]),
    scale: modelPresentationVector(pose.scale, MODEL_POSE_COMPONENTS[2])});
}

// Position is in metres. Reflect the coordinate basis, then postmultiply the local model alignment.
export function modelPoseForBinding(value: ModelPresentationPose, binding: ModelPoseBinding): ModelPresentationPose {
  const source = modelPresentationPose(value, MODEL_POSE_BINDING_OWNER);
  if (!object(binding)) throw new ModelStageRefusal(MODEL_POSE_REFUSAL.binding);
  const reflectZ = modelFlag(binding.reflectZ, 'The pose binding.reflectZ');
  const [bx, by, bz, bw] = modelPresentationRotation(binding.rotationQuaternion, 'The pose binding.rotationQuaternion');
  const [x, y, z, aw] = source.rotationQuaternion;
  const ax = reflectZ ? -x : x, ay = reflectZ ? -y : y, az = z;
  const result = [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz];
  const length = Math.hypot(...result);
  return Object.freeze({
    position: Object.freeze([source.position[0], source.position[1], reflectZ ? -source.position[2] :
      source.position[2]]) as ModelVector,
    rotationQuaternion: Object.freeze(result.map(component => component / length)) as unknown as ModelRotation,
    scale: source.scale,
  });
}
