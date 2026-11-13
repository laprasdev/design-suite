import {ModelStageRefusal} from './refusal.ts';

// A record of the description states exactly its fields: one it omits and one it does not have are each refused by
// name, so nothing missing is read as "off" and nothing misspelt is dropped.
export const MODEL_RECORD_REFUSAL = Object.freeze({
  record: (where: string, fields: readonly string[]) => `${where} is a record of ${fields.join(', ')}.`,
  omitted: (where: string, field: string) => `${where} omits ${field}.`,
  stray: (where: string, field: string, fields: readonly string[]) =>
    `${where} does not state ${field}; it states ${fields.join(', ')}.`,
});

export function modelRecord(value: unknown, fields: readonly string[], where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.record(where, fields));
  }
  const record = value as Record<string, unknown>;
  const omitted = fields.find(field => !(field in record));
  if (omitted) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.omitted(where, omitted));
  const stray = Object.keys(record).find(field => !fields.includes(field));
  if (stray) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.stray(where, stray, fields));
  return record;
}

/** A finite number within the stated bounds, refused by its name otherwise; an unbounded end is an infinity. */
export function modelNumber(value: unknown, where: string, least: number, most: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < least || value > most) {
    const range = !Number.isFinite(least) ? '' : Number.isFinite(most) ? ` from ${least} to ${most}` :
      ` of at least ${least}`;
    throw new ModelStageRefusal(`${where} must be a finite number${range}.`);
  }
  return value;
}
