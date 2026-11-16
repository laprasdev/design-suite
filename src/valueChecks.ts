// Checks that narrow a decoded value (parsed JSON, a skin, a host's description, a tool's report) to the form its
// reader expects. A leaf: readers anywhere compose these and keep their own record shapes and refusals.

/** A check that narrows a decoded value to `Value`. */
export type ValueCheck<Value> = (value: unknown) => value is Value;

/** Whether a value is a record: an object that is not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isString = (value: unknown): value is string => typeof value === 'string';
/** Whether a value is a non-empty string, the form of an id or a name. */
export const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;
/** Whether a value is a list whose every entry holds `check`. */
export const isListOf = <Value>(check: ValueCheck<Value>) => (value: unknown): value is readonly Value[] =>
  Array.isArray(value) && value.every(check);
/** Whether a value is a list whose every entry is a string. */
export const isStringList = isListOf(isString);
/** Whether a value is a record whose every member, under any name, holds `check`. */
export const isRecordOf = <Value>(check: ValueCheck<Value>) => (value: unknown): value is Record<string, Value> =>
  isRecord(value) && Object.values(value).every(check);

/**
 * A record's fields, each with the check its value holds to: the one declaration that the record's type
 * (`ShapeOf`), its check (`holdsShape`) and the fields its reader takes (`Object.keys`) all derive from.
 */
export type RecordShape = Readonly<Record<string, ValueCheck<unknown>>>;
export type ShapeOf<Shape extends RecordShape> = {
  readonly [Field in keyof Shape]: Shape[Field] extends ValueCheck<infer Value> ? Value : never;
};
/** Whether a value is a record each of whose fields `shape` names holds that field's check. */
export const holdsShape = <Shape extends RecordShape>(shape: Shape) => (value: unknown): value is ShapeOf<Shape> =>
  isRecord(value) && Object.entries(shape).every(([field, check]) => check(value[field]));
