import {isNonEmptyString, isRecord} from '../../valueChecks.ts';
import {ModelStageRefusal} from './refusal.ts';

// The one owner of a description's records. A record states exactly its fields: one it omits and one it does not
// have are each refused by name, so nothing missing is read as "off" and nothing misspelt is dropped. A record of
// several whole shapes names its shape in one field, and then states exactly that shape's fields. Only a record's own
// fields count: a name it inherits (`toString`, `constructor`) is never one of its fields, and a lookup by a name the
// data chose (a set, a parameter, an inert value) asks whether the record states it (`modelStates`).
export const MODEL_RECORD_REFUSAL = Object.freeze({
  record: (where: string, fields: readonly string[]) => `${where} is a record of ${fields.join(', ')}.`,
  omitted: (where: string, field: string, fields: readonly string[]) =>
    `${where} omits ${field}; it states ${fields.join(', ')}.`,
  stray: (where: string, field: string, fields: readonly string[]) =>
    `${where} does not state ${field}; it states ${fields.join(', ')}.`,
  unstated: (where: string, field: string) => `${where}.${field} is stated with no value; state one or leave it out.`,
  shape: (where: string, field: string, shapes: readonly string[]) =>
    `${where}.${field} is one of ${shapes.join(', ')}.`,
  entries: (where: string, element: string) => `${where} is a record of ${element}.`,
  named: (where: string) => `${where} must be a non-empty string.`,
  oneOf: (where: string, names: readonly string[]) => `${where} states exactly one of ${names.join(', ')}.`,
  digest: (where: string) => `${where} must be a SHA-256: 64 lowercase hex digits.`,
  option: (where: string, options: readonly unknown[]) => `${where} is one of ${options.join(', ')}.`,
  flag: (where: string) => `${where} is stated as true or false.`,
  numbers: (where: string, count: number) => `${where} must contain ${count} finite numbers.`,
});
const DIGEST = /^[a-f0-9]{64}$/;
const refusal = MODEL_RECORD_REFUSAL;

/** Whether a record states a field of its own. */
export const modelStates = (value: object, field: string) => Object.hasOwn(value, field);

// Written as loops over the fields, so that a check on a tick's path (a frame's pose) makes no array or closure.
function exact(value: Record<string, unknown>, fields: readonly string[], where: string) {
  for (let index = 0; index < fields.length; index++) {
    if (!modelStates(value, fields[index])) throw new ModelStageRefusal(refusal.omitted(where, fields[index], fields));
  }
  for (const field in value) {
    if (modelStates(value, field) && !fields.includes(field)) {
      throw new ModelStageRefusal(refusal.stray(where, field, fields));
    }
  }
}

export function modelRecord(value: unknown, fields: readonly string[], where: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ModelStageRefusal(refusal.record(where, fields));
  exact(value, fields, where);
  return value;
}

/**
 * A record whose `whenStated` fields are each either stated with a value or left out (an asset's revision, a box's
 * rotation): the fields it states are exactly its `stated` ones and those of `whenStated` it names. A field named
 * with no value is refused, never read as left out.
 */
export function modelRecordStating(value: unknown, fields: {readonly stated: readonly string[];
  readonly whenStated: readonly string[]}, where: string): Record<string, unknown> {
  const all = [...fields.stated, ...fields.whenStated];
  if (!isRecord(value)) throw new ModelStageRefusal(refusal.record(where, all));
  const named = fields.whenStated.filter(field => modelStates(value, field));
  const unstated = named.find(field => value[field] === undefined);
  if (unstated) throw new ModelStageRefusal(refusal.unstated(where, unstated));
  exact(value, [...fields.stated, ...named], where);
  return value;
}

/**
 * A record of one of several whole shapes: `field` names the shape, and the record then states exactly that shape's
 * fields. Returns the shape's name with the record.
 */
export function modelShape<Shape extends string>(value: unknown, field: string,
  shapes: Readonly<Record<Shape, readonly string[]>>, where: string): {shape: Shape; record: Record<string, unknown>} {
  const names = Object.keys(shapes) as Shape[];
  const shape = isRecord(value) && modelStates(value, field) ? names.find(name => name === value[field]) :
    undefined;
  if (shape === undefined) throw new ModelStageRefusal(refusal.shape(where, field, names));
  return {shape, record: modelRecord(value, shapes[shape], where)};
}

/** A record whose names are the data's own (a kind's parameters, a description's sets): its own entries. `element`
 * says what each entry is, for the refusal: "surface sets by name". */
export function modelEntries(value: unknown, where: string, element: string): [string, unknown][] {
  if (!isRecord(value)) throw new ModelStageRefusal(refusal.entries(where, element));
  return Object.entries(value);
}

/** A record of exactly one field, one of these names: which it states, and what that field holds. */
export function modelOneOf<Name extends string>(value: unknown, names: readonly Name[], where: string) {
  const stated = isRecord(value) ? names.filter(name => modelStates(value, name)) : [];
  if (stated.length !== 1) throw new ModelStageRefusal(refusal.oneOf(where, names));
  const [name] = stated;
  return {name, content: modelRecord(value, [name], where)[name]};
}

/**
 * A value's identity: its text with every record's fields in one order (sorted), so that two values equal by value
 * are one, whatever order they were written in (a record's values, a texture's fields). Lists keep their order: in the
 * description an order is data (the actors, a colour's channels).
 */
export const modelRecordIdentity = (value: unknown): string => JSON.stringify(value, (_, item: unknown) =>
  isRecord(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) :
    item);

/** Whether a value is a SHA-256 as the description states every file's: 64 lowercase hex digits. */
export const modelIsDigest = (value: unknown): value is string => typeof value === 'string' && DIGEST.test(value);
/** A SHA-256, refused by its name otherwise. */
export function modelDigest(value: unknown, where: string): string {
  if (!modelIsDigest(value)) throw new ModelStageRefusal(refusal.digest(where));
  return value;
}

/** One of a closed set of values, refused by its name otherwise, listing the set. */
export function modelOption<Option>(value: unknown, options: Readonly<Record<string, Option>>, where: string): Option {
  const all = Object.values(options), found = all.find(option => option === value);
  if (found === undefined) throw new ModelStageRefusal(refusal.option(where, all));
  return found;
}

/** True or false, refused by its name otherwise. */
export function modelFlag(value: unknown, where: string): boolean {
  if (typeof value !== 'boolean') throw new ModelStageRefusal(refusal.flag(where));
  return value;
}

/** A non-empty string, refused by its name otherwise. */
export function modelName(value: unknown, where: string): string {
  if (!isNonEmptyString(value)) throw new ModelStageRefusal(refusal.named(where));
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

/** Exactly `count` finite numbers, copied (a sparse array's holes read as missing, never skipped), refused by their
 * name otherwise. */
export function modelNumbers(value: unknown, count: number, where: string): number[] {
  const copy = Array.isArray(value) ? Array.from(value) : [];
  if (copy.length !== count || !copy.every(Number.isFinite)) throw new ModelStageRefusal(refusal.numbers(where, count));
  return copy;
}
