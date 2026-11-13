import {ModelStageRefusal} from './refusal.ts';

// The one owner of a description's records. A record states exactly its fields: one it omits and one it does not
// have are each refused by name, so nothing missing is read as "off" and nothing misspelt is dropped. A record of
// several whole shapes names its shape in one field, and then states exactly that shape's fields.
export const MODEL_RECORD_REFUSAL = Object.freeze({
  record: (where: string, fields: readonly string[]) => `${where} is a record of ${fields.join(', ')}.`,
  omitted: (where: string, field: string) => `${where} omits ${field}.`,
  stray: (where: string, field: string, fields: readonly string[]) =>
    `${where} does not state ${field}; it states ${fields.join(', ')}.`,
  shape: (where: string, field: string, shapes: readonly string[]) =>
    `${where} states its ${field}, one of ${shapes.join(', ')}.`,
  named: (where: string) => `${where} must be a non-empty string.`,
});

/** Whether a value is a record at all: an object that is not an array. */
export const modelIsRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** Whether a value is a non-empty string, the form of every id and name the description carries. */
export const modelIsNamed = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export function modelRecord(value: unknown, fields: readonly string[], where: string): Record<string, unknown> {
  if (!modelIsRecord(value)) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.record(where, fields));
  const omitted = fields.find(field => !(field in value));
  if (omitted) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.omitted(where, omitted));
  const stray = Object.keys(value).find(field => !fields.includes(field));
  if (stray) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.stray(where, stray, fields));
  return value;
}

/**
 * A record of one of several whole shapes: `field` names the shape, and the record then states exactly that shape's
 * fields. Returns the shape's name with the record.
 */
export function modelShape<Shape extends string>(value: unknown, field: string,
  shapes: Readonly<Record<Shape, readonly string[]>>, where: string): {shape: Shape; record: Record<string, unknown>} {
  const names = Object.keys(shapes) as Shape[];
  const shape = modelIsRecord(value) ? names.find(name => name === value[field]) : undefined;
  if (shape === undefined) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.shape(where, field, names));
  return {shape, record: modelRecord(value, shapes[shape], where)};
}

/** A non-empty string, refused by its name otherwise. */
export function modelName(value: unknown, where: string): string {
  if (!modelIsNamed(value)) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.named(where));
  return value;
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
