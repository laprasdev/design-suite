import {isFiniteNumber, isNonEmptyString, isRecord} from '../../valueChecks.ts';
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
const EMPTY_FIELDS: readonly string[] = Object.freeze([]);
const refusal = MODEL_RECORD_REFUSAL;

/** Whether a record states a field of its own. */
export const modelStates = (value: object, field: string) => Object.hasOwn(value, field);

export interface ModelStatingFields {
  readonly stated: readonly string[];
  readonly whenStated: readonly string[];
}

function statedWith(value: Record<string, unknown>, stated: readonly string[], whenStated: readonly string[]) {
  return [...stated, ...whenStated.filter(field => modelStates(value, field))];
}

// The first optional field a record states with no value, or none. Off a tick's path only: a number read by a computed
// key is boxed, so a tick's reader leaves each value to its own check by name.
function unstatedField(value: Record<string, unknown>, whenStated: readonly string[]) {
  for (let index = 0; index < whenStated.length; index++) {
    const field = whenStated[index];
    if (modelStates(value, field) && value[field] === undefined) return field;
  }
  return undefined;
}
// The first field that keeps a record's keys from being exactly its fields (one omitted, then one it does not have), or
// none. Written as loops over the fields that read no value, so that a check on a tick's path (a frame's pose, camera
// or emitter changes) makes no array, closure, text or number unless it refuses.
function inexactKey(value: Record<string, unknown>, stated: readonly string[], whenStated: readonly string[]) {
  for (let index = 0; index < stated.length; index++) {
    if (!modelStates(value, stated[index])) return stated[index];
  }
  for (const field in value) {
    if (modelStates(value, field) && !stated.includes(field) && !whenStated.includes(field)) return field;
  }
  return undefined;
}
// Names why `field` keeps the record inexact, on the refusal path only: `unstatedField` and `inexactKey` return the
// field alone so the tick's check builds no text, and this re-reads their three cases to say which one it is.
function inexactText(value: Record<string, unknown>, field: string, stated: readonly string[],
  whenStated: readonly string[], where: string) {
  if (!modelStates(value, field)) return refusal.omitted(where, field, statedWith(value, stated, whenStated));
  if (whenStated.includes(field) && value[field] === undefined) return refusal.unstated(where, field);
  return refusal.stray(where, field, statedWith(value, stated, whenStated));
}
function exact(value: unknown, stated: readonly string[], whenStated: readonly string[],
  where: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ModelStageRefusal(refusal.record(where, [...stated, ...whenStated]));
  const field = unstatedField(value, whenStated) ?? inexactKey(value, stated, whenStated);
  if (field !== undefined) throw new ModelStageRefusal(inexactText(value, field, stated, whenStated, where));
  return value;
}
/** Whether `value` is a record whose keys are exactly `fields`; asks without naming where, so it builds no text, and
 * reads no value, so it boxes no number. Each value, an optional one stated with none included, is its reader's check
 * by name, as a stated field's always was. A reader on a tick's path asks this first and reads again with its `where`
 * (`modelRecordStating`) only to refuse. */
export const modelStatesExactly = (value: unknown, fields: ModelStatingFields): value is Record<string, unknown> =>
  isRecord(value) && inexactKey(value, fields.stated, fields.whenStated) === undefined;

export const modelRecord = (value: unknown, fields: readonly string[], where: string): Record<string, unknown> =>
  exact(value, fields, EMPTY_FIELDS, where);

/**
 * A record whose `whenStated` fields are each either stated with a value or left out (an asset's revision, a box's
 * rotation, a camera's fieldOfView): the fields it states are exactly its `stated` ones and those of `whenStated` it
 * names. A field named with no value is refused, never read as left out.
 */
export const modelRecordStating = (value: unknown, fields: ModelStatingFields,
  where: string): Record<string, unknown> => exact(value, fields.stated, fields.whenStated, where);

/**
 * A record of one of several whole shapes: `field` names the shape, and the record then states exactly that shape's
 * fields. Returns the shape's name with the record.
 */
export function modelShape<Shape extends string>(value: unknown, field: string,
  shapes: Readonly<Record<Shape, ModelStatingFields>>, where: string): {shape: Shape; record: Record<string, unknown>} {
  const names = Object.keys(shapes) as Shape[];
  const shape = isRecord(value) && modelStates(value, field) ? names.find(name => name === value[field]) :
    undefined;
  if (shape === undefined) throw new ModelStageRefusal(refusal.shape(where, field, names));
  return {shape, record: modelRecordStating(value, shapes[shape], where)};
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

/** Whether a value is a SHA-256 as the description states every file's: 64 lowercase hex digits. */
export const modelIsDigest = (value: unknown): value is string => typeof value === 'string' && DIGEST.test(value);
/** A SHA-256, refused by its name otherwise. */
export function modelDigest(value: unknown, where: string): string {
  if (!modelIsDigest(value)) throw new ModelStageRefusal(refusal.digest(where));
  return value;
}

/** One of a closed set of values, refused by its name otherwise, listing the set. */
export function modelOption<Option>(value: unknown, options: Readonly<Record<string, Option>>, where: string): Option {
  if (modelIsOption(value, options)) return value;
  throw new ModelStageRefusal(refusal.option(where, Object.values(options)));
}
/** Whether `value` is one of a closed set, asked without naming where. A loop, not `Object.values`: a frame reader
 * asks this per tick, and only a refusal lists the set. */
export function modelIsOption<Option>(value: unknown, options: Readonly<Record<string, Option>>): value is Option {
  for (const name in options) {
    if (options[name] === value) return true;
  }
  return false;
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
  if (!isFiniteNumber(value) || value < least || value > most) {
    const range = !Number.isFinite(least) ? '' : Number.isFinite(most) ? ` from ${least} to ${most}` :
      ` of at least ${least}`;
    throw new ModelStageRefusal(`${where} must be a finite number${range}.`);
  }
  return value;
}

function readCheckedNumbers<Target extends number[] | Float64Array>(
  value: unknown, count: number, into: Target, offset: number, where: string,
): Target {
  if (!Array.isArray(value) || value.length !== count) {
    throw new ModelStageRefusal(refusal.numbers(where, count));
  }
  for (let index = 0; index < count; index++) {
    const item: unknown = value[index];
    if (!isFiniteNumber(item)) {
      throw new ModelStageRefusal(refusal.numbers(where, count));
    }
    into[offset + index] = item;
  }
  return into;
}

/** Writes `count` finite numbers into `into` at `offset` (sparse holes read as missing, never skipped); makes no array
 * or string on valid input. */
export function readModelNumbers(value: unknown, count: number, into: Float64Array, offset: number,
  where: string): void {
  readCheckedNumbers(value, count, into, offset, where);
}

/** Exactly `count` finite numbers, copied (a sparse array's holes read as missing, never skipped), refused by their
 * name otherwise. */
export const modelNumbers = (value: unknown, count: number, where: string): number[] =>
  readCheckedNumbers(value, count, new Array<number>(count), 0, where);
