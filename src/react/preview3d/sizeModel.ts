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
