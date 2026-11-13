import {ModelStageRefusal} from './refusal.ts';

// The stage's placement data, with no renderer: vectors, unit rotations and whole poses, their validators and the one
// coordinate adapter. Every other preview file reaches these through here, so none of them imports another for them.
export type ModelVector = readonly [number, number, number];
export type ModelRotation = readonly [number, number, number, number];
export const MODEL_PREVIEW_QUATERNION_TOLERANCE = 1e-4;
// A pose is whole: every component is stated, so no component is ever taken from an earlier pose or an identity.
export const MODEL_POSE_COMPONENTS = Object.freeze(['position', 'rotationQuaternion', 'scale'] as const);
export const MODEL_POSE_REFUSAL = Object.freeze({
  omitted: (owner: string, component: string) =>
    `${owner}: the pose omits ${component}; it states ${MODEL_POSE_COMPONENTS.join(', ')}.`,
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
/** A whole pose; a refusal names its owner and the component it omits. */
export function modelPresentationPose(value: unknown, owner: string): ModelPresentationPose {
  const omitted = MODEL_POSE_COMPONENTS.find(component => !object(value) || value[component] === undefined);
  if (omitted) throw new ModelStageRefusal(MODEL_POSE_REFUSAL.omitted(owner, omitted));
  const whole = value as Record<string, unknown>;
  return Object.freeze({position: modelPresentationVector(whole.position, 'position'),
    rotationQuaternion: modelPresentationRotation(whole.rotationQuaternion),
    scale: modelPresentationVector(whole.scale, 'scale')});
}

// Position is in metres. Reflect the coordinate basis, then postmultiply the local model alignment.
export function modelPoseForBinding(value: ModelPresentationPose, binding: ModelPoseBinding): ModelPresentationPose {
  const source = modelPresentationPose(value, MODEL_POSE_BINDING_OWNER);
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
