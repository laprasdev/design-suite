import {ModelStageRefusal} from './refusal.ts';

export const MODEL_STAGE_SIZE = Object.freeze({real: 'real', normalized: 'normalized'} as const);
/**
 * The stage's one size rule, for every actor alike: each at its file's real size, so sizes stay relative to one
 * another; or each normalized to one height.
 */
export type ModelStageSize = {readonly rule: typeof MODEL_STAGE_SIZE.real}
  | {readonly rule: typeof MODEL_STAGE_SIZE.normalized; readonly height: number};
export const MODEL_STAGE_SIZE_REFUSAL = `A stage size is {rule: '${MODEL_STAGE_SIZE.real}'} or ` +
  `{rule: '${MODEL_STAGE_SIZE.normalized}', height} with a positive finite height, and states nothing else.`;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function modelStageSize(value: unknown): ModelStageSize {
  const fields = object(value) ? Object.keys(value).sort().join() : undefined;
  if (object(value) && value.rule === MODEL_STAGE_SIZE.real && fields === 'rule') {
    return Object.freeze({rule: MODEL_STAGE_SIZE.real});
  }
  if (!object(value) || value.rule !== MODEL_STAGE_SIZE.normalized || fields !== 'height,rule' ||
    typeof value.height !== 'number' || !Number.isFinite(value.height) || value.height <= 0) {
    throw new ModelStageRefusal(MODEL_STAGE_SIZE_REFUSAL);
  }
  return Object.freeze({rule: MODEL_STAGE_SIZE.normalized, height: value.height});
}

export const MODEL_STAGE_ORIGIN = Object.freeze({file: 'file', centred: 'centred'} as const);
/**
 * Where each actor's model sits in its placement: at the file's own origin, as an engine places it; or centred over the
 * placement with its lowest point on it, as a catalog shows a model.
 */
export type ModelStageOrigin = typeof MODEL_STAGE_ORIGIN[keyof typeof MODEL_STAGE_ORIGIN];
export const MODEL_STAGE_ORIGIN_REFUSAL = `A stage origin is one of ${Object.values(MODEL_STAGE_ORIGIN).join(', ')}.`;
export function modelStageOrigin(value: unknown): ModelStageOrigin {
  const origin = Object.values(MODEL_STAGE_ORIGIN).find(candidate => candidate === value);
  if (!origin) throw new ModelStageRefusal(MODEL_STAGE_ORIGIN_REFUSAL);
  return origin;
}
