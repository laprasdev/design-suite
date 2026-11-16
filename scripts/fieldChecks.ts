// Checks that a decoded record (a baseline, a manifest, a tool's output) holds the form its reader expects, each
// refusing by name: where in the record the value sits and what it must be. A record's shape names each field with
// its check; the record's type (`ShapeOf`) and its check (`holdsShape`) derive from it, and one walk runs every check.
import { isNonEmptyString, isRecord, isString, type ValueCheck } from '../src/valueChecks.ts';

/** Throws, saying where in the record a value sits (empty for the record itself) and why it is refused. */
export type Refusal = (where: string, why: string) => never;
/** Returns when `value`, read at `where`, holds `Value`; refuses through `refuse` when it does not. */
export type FieldCheck<Value> = (value: unknown, where: string, refuse: Refusal) => asserts value is Value;

/** A record's fields, each with its check. */
export type CheckShape = Readonly<Record<string, FieldCheck<unknown>>>;
export type ShapeOf<Shape extends CheckShape> = {
  readonly [Field in keyof Shape]: Shape[Field] extends FieldCheck<infer Value> ? Value : never;
};

/** What a record may hold beside the fields it names: a stored format holds nothing more; a tool's output may. */
export const OTHER_FIELDS = Object.freeze({ refused: 'refused', ignored: 'ignored' } as const);
export type OtherFields = typeof OTHER_FIELDS[keyof typeof OTHER_FIELDS];

/** A refusal that names the record itself `record` and hands each reason to `fail`. */
export const refusalBy = (fail: (reason: string) => never, record: string): Refusal =>
  (where, why) => fail(`${where || record} ${why}`);

const fieldAt = (where: string, field: string): string => (where ? `${where}.${field}` : field);
export const entryAt = (where: string, key: string): string => `${where}[${JSON.stringify(key)}]`;

/** `check` as a field's check, refusing a value it does not hold as not `expected`. */
const refusedUnless = <Value>(check: ValueCheck<Value>, expected: string): FieldCheck<Value> =>
  (value, where, refuse) => {
    if (!check(value)) refuse(where, `must be ${expected}`);
  };

export const holdsString: FieldCheck<string> = refusedUnless(isString, 'a string');
export const holdsNonEmptyString: FieldCheck<string> = refusedUnless(isNonEmptyString, 'a non-empty string');
const isNumber = (value: unknown): value is number => typeof value === 'number';
export const holdsNumber: FieldCheck<number> = refusedUnless(isNumber, 'a number');
export const holdsRecord: FieldCheck<Readonly<Record<string, unknown>>> = refusedUnless(isRecord, 'a record');

/** A record's form: the fields it names, the check of each, and what it may hold beside them. */
interface RecordForm {
  readonly fields: readonly string[];
  readonly checkOf: (field: string) => FieldCheck<unknown>;
  readonly others: OtherFields;
}

/** The one walk of a record: each field its form names through that field's check, any other as the form says. */
function checkFields(value: unknown, where: string, refuse: Refusal, { fields, checkOf, others }: RecordForm): void {
  holdsRecord(value, where, refuse);
  if (others === OTHER_FIELDS.refused) {
    for (const field of Object.keys(value)) {
      if (!fields.includes(field)) refuse(where, `holds ${field}; it takes ${fields.join(', ')}`);
    }
  }
  for (const field of fields) {
    const check: FieldCheck<unknown> = checkOf(field);
    check(value[field], fieldAt(where, field), refuse);
  }
}

/** A record holding each field `shape` names, of that field's check. */
export const holdsShape = <Shape extends CheckShape>(shape: Shape, others: OtherFields): FieldCheck<ShapeOf<Shape>> =>
  (value, where, refuse) => {
    checkFields(value, where, refuse, { fields: Object.keys(shape), checkOf: field => shape[field], others });
  };

/** A record holding each of `fields`, every one of `check`. */
export const holdsFields = <Field extends string, Value>(
  fields: readonly Field[],
  check: FieldCheck<Value>,
  others: OtherFields,
): FieldCheck<Readonly<Record<Field, Value>>> =>
  (value, where, refuse) => checkFields(value, where, refuse, { fields, checkOf: () => check, others });

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
