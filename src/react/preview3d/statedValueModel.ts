import {modelEntries, modelNumber} from './recordModel.ts';

/**
 * A value a description states and the stage keeps as stated, read or not: JSON with finite numbers, frozen whole.
 * Reading one again gives an equal one, so a description that holds it reads back as itself.
 */
export type ModelStatedValue = null | boolean | number | string | readonly ModelStatedValue[] |
  {readonly [field: string]: ModelStatedValue};

/** A frozen copy of a stated value, refused by name where it holds anything else. */
export function modelStatedValue(value: unknown, where: string): ModelStatedValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return modelNumber(value, where, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item: unknown, index) => modelStatedValue(item, `${where}.${index}`)));
  }
  return modelStatedRecord(value, where);
}
/** A frozen copy of a stated record of stated values. */
export const modelStatedRecord = (value: unknown, where: string): {readonly [field: string]: ModelStatedValue} =>
  Object.freeze(Object.fromEntries(modelEntries(value, where, 'stated values')
    .map(([field, item]) => [field, modelStatedValue(item, `${where}.${field}`)])));
