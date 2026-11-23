// Checks that narrow a decoded value (parsed JSON, a skin, a host's description) to the form its reader expects. A
// leaf: the library's readers compose these, and so do the repository's scripts, whose record checks, which refuse by
// name, are scripts/build/fieldChecks.ts.

/** A check that narrows a decoded value to `Value`. */
export type ValueCheck<Value> = (value: unknown) => value is Value;

/** Whether a value is a record: an object that is not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isString = (value: unknown): value is string => typeof value === 'string';
export const isNumber = (value: unknown): value is number => typeof value === 'number';
/** Whether a value is a number that is neither infinite nor NaN. */
export const isFiniteNumber = (value: unknown): value is number => isNumber(value) && Number.isFinite(value);
/** Whether a value is a non-empty string, the form of an id or a name. */
export const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;
