import {ModelStageRefusal} from './refusal.ts';
import {modelNumber, modelOption, modelShape} from './recordModel.ts';

export const MODEL_STAGE_SIZE = Object.freeze({real: 'real', normalized: 'normalized'} as const);
/**
 * The stage's one size rule, for every actor alike: each at its file's real size, so sizes stay relative to one
 * another; or each normalized to one height.
 */
export type ModelStageSize = {readonly rule: typeof MODEL_STAGE_SIZE.real}
  | {readonly rule: typeof MODEL_STAGE_SIZE.normalized; readonly height: number};
export const MODEL_STAGE_SIZE_REFUSAL = Object.freeze({
  height: (where: string) => `${where} must be greater than 0.`,
});
// The fields each size rule states, and nothing else.
const FIELDS = Object.freeze({real: ['rule'], normalized: ['rule', 'height']});
const WHERE = 'The stage size';

export function modelStageSize(value: unknown): ModelStageSize {
  const {shape: rule, record} = modelShape(value, 'rule', FIELDS, WHERE);
  if (rule === MODEL_STAGE_SIZE.real) return Object.freeze({rule});
  const height = modelNumber(record.height, `${WHERE}.height`, 0, Number.POSITIVE_INFINITY);
  if (!(height > 0)) throw new ModelStageRefusal(MODEL_STAGE_SIZE_REFUSAL.height(`${WHERE}.height`));
  return Object.freeze({rule, height});
}

export const MODEL_STAGE_ORIGIN = Object.freeze({file: 'file', centred: 'centred'} as const);
/**
 * Where each actor's model sits in its placement: at the file's own origin, as an engine places it; or centred over the
 * placement with its lowest point on it, as a catalog shows a model.
 */
export type ModelStageOrigin = typeof MODEL_STAGE_ORIGIN[keyof typeof MODEL_STAGE_ORIGIN];
/** A description's origin, refused by its name otherwise, listing the origins. */
export const modelStageOrigin = (value: unknown): ModelStageOrigin =>
  modelOption(value, MODEL_STAGE_ORIGIN, 'The stage description.origin');
