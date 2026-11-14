// Checks that narrow a decoded value (parsed JSON, a skin, a host's description, a tool's report) to the form its
// reader expects. A leaf: readers anywhere compose these and keep their own record shapes and refusals.

/** Whether a value is a record: an object that is not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
/** Whether a value is a non-empty string, the form of an id or a name. */
export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
