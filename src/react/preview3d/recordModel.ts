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
  oneOf: (where: string, names: readonly string[]) => `${where} states exactly one of ${names.join(', ')}.`,
  digest: (where: string) => `${where} must be a SHA-256: 64 lowercase hex digits.`,
  option: (where: string, options: readonly unknown[]) => `${where} is one of ${options.join(', ')}.`,
  flag: (where: string) => `${where} is stated as true or false.`,
});
const DIGEST = /^[a-f0-9]{64}$/;

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

/** A record whose names are the data's own (a kind's parameters, a description's sets): its entries. */
export function modelEntries(value: unknown, where: string): [string, unknown][] {
  if (!modelIsRecord(value)) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.record(where, ['its entries']));
  return Object.entries(value);
}

/** A record of exactly one field, one of these names: which it states, and what that field holds. */
export function modelOneOf<Name extends string>(value: unknown, names: readonly Name[], where: string) {
  const stated = modelIsRecord(value) ? names.filter(name => name in value) : [];
  if (stated.length !== 1) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.oneOf(where, names));
  const [name] = stated;
  return {name, content: modelRecord(value, [name], where)[name]};
}

/** Whether a value is a SHA-256 as the description states every file's: 64 lowercase hex digits. */
export const modelIsDigest = (value: unknown): value is string => typeof value === 'string' && DIGEST.test(value);
/** A SHA-256, refused by its name otherwise. */
export function modelDigest(value: unknown, where: string): string {
  if (!modelIsDigest(value)) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.digest(where));
  return value;
}

/** One of a closed set of values, refused by its name otherwise, listing the set. */
export function modelOption<Option>(value: unknown, options: Readonly<Record<string, Option>>, where: string): Option {
  const all = Object.values(options), found = all.find(option => option === value);
  if (found === undefined) throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.option(where, all));
  return found;
}

/** True or false, refused by its name otherwise. */
export function modelFlag(value: unknown, where: string): boolean {
  if (typeof value !== 'boolean') throw new ModelStageRefusal(MODEL_RECORD_REFUSAL.flag(where));
  return value;
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
