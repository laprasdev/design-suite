// Checks that a decoded record (a baseline, a manifest, a tool's output) holds the form its reader expects, each
// refusing by name: where in the record the value sits and what it must be. A record's shape names each field with
// its check; the record's type (`ShapeOf`) and its check (`holdsShape`) derive from it, and one walk runs every check.
import { isNonEmptyString, isNumber, isRecord, isString, type ValueCheck } from '../../src/valueChecks.ts';

/** Throws, saying where in the record a value sits (empty for the record itself) and why it is refused. */
export type Refusal = (where: string, why: string) => never;
/** Returns when `value`, read at `where`, holds `Value`; refuses through `refuse` when it does not. */
export type FieldCheck<Value> = (value: unknown, where: string, refuse: Refusal) => asserts value is Value;

/** A record's fields, each with its check. */
type CheckShape = Readonly<Record<string, FieldCheck<unknown>>>;
/** The value `Check` holds. */
type Checked<Check> = Check extends FieldCheck<infer Value> ? Value : never;
export type ShapeOf<Shape extends CheckShape> = { readonly [Field in keyof Shape]: Checked<Shape[Field]> };

/** What a record may hold beside the fields it names: a stored format holds nothing more; a tool's output may. */
export const OTHER_FIELDS = Object.freeze({ refused: 'refused', ignored: 'ignored' } as const);
type OtherFields = typeof OTHER_FIELDS[keyof typeof OTHER_FIELDS];

/** A refusal that names the record itself `record` and hands each reason to `fail`. */
export const refusalBy = (fail: (reason: string) => never, record: string): Refusal =>
  (where, why) => fail(`${where || record} ${why}`);

export const fieldAt = (where: string, field: string): string => (where ? `${where}.${field}` : field);
export const entryAt = (where: string, key: string): string => `${where}[${JSON.stringify(key)}]`;

/** `check` as a field's check, refusing a value it does not hold as not `expected`. */
const refusedUnless = <Value>(check: ValueCheck<Value>, expected: string): FieldCheck<Value> =>
  (value, where, refuse) => {
    if (!check(value)) refuse(where, `must be ${expected}`);
  };

export const holdsString: FieldCheck<string> = refusedUnless(isString, 'a string');
export const holdsNonEmptyString: FieldCheck<string> = refusedUnless(isNonEmptyString, 'a non-empty string');
export const holdsNumber: FieldCheck<number> = refusedUnless(isNumber, 'a number');
export const holdsRecord: FieldCheck<Readonly<Record<string, unknown>>> = refusedUnless(isRecord, 'a record');

/** A record holding each field `shape` names, of that field's check, and any other field as `others` says. */
export const holdsShape = <Shape extends CheckShape>(shape: Shape, others: OtherFields): FieldCheck<ShapeOf<Shape>> =>
  (value, where, refuse) => {
    holdsRecord(value, where, refuse);
    const fields = Object.keys(shape);
    if (others === OTHER_FIELDS.refused) {
      for (const field of Object.keys(value)) {
        if (!fields.includes(field)) refuse(where, `holds ${field}; it takes ${fields.join(', ')}`);
      }
    }
    for (const field of fields) {
      const check: FieldCheck<unknown> = shape[field];
      check(value[field], fieldAt(where, field), refuse);
    }
  };

/** The shape of a record whose every field in `fields` takes `check`. */
export function fieldsHolding<Field extends string, Value>(
  fields: readonly Field[],
  check: FieldCheck<Value>,
): Readonly<Record<Field, FieldCheck<Value>>>;
// `Object.fromEntries` keys what it builds by `string`; the signature above names the keys it holds, exactly `fields`.
export function fieldsHolding<Value>(fields: readonly string[], check: FieldCheck<Value>): CheckShape {
  return Object.freeze(Object.fromEntries(fields.map(field => [field, check])));
}

/** `check`, or nothing: a field a record may leave out. */
export const holdsOptional = <Value>(check: FieldCheck<Value>): FieldCheck<Value | undefined> =>
  (value, where, refuse) => {
    if (value !== undefined) check(value, where, refuse);
  };

/** A list whose every entry holds `check`. */
export const holdsListOf = <Value>(check: FieldCheck<Value>): FieldCheck<readonly Value[]> =>
  (value, where, refuse) => {
    if (!Array.isArray(value)) return refuse(where, 'must be a list');
    for (const [index, entry] of value.entries()) check(entry, `${where}[${index}]`, refuse);
  };

/** A record whose every member, under any name, holds `check`. */
export const holdsRecordOf = <Value>(check: FieldCheck<Value>): FieldCheck<Readonly<Record<string, Value>>> =>
  (value, where, refuse) => {
    holdsRecord(value, where, refuse);
    for (const [key, entry] of Object.entries(value)) check(entry, entryAt(where, key), refuse);
  };

export const holdsStringList: FieldCheck<readonly string[]> = holdsListOf(holdsString);
