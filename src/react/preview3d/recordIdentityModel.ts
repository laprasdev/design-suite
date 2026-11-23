import {isRecord} from '../../valueChecks.ts';

const INSTANCE_TAG_PREFIX = '\u0000model-instance:';
const instanceIds = new WeakMap<object, string>();
let nextInstanceId = 0;
function instanceTag(value: object): string {
  const held = instanceIds.get(value);
  if (held !== undefined) return held;
  const fresh = `${INSTANCE_TAG_PREFIX}${++nextInstanceId}`;
  instanceIds.set(value, fresh);
  return fresh;
}

/**
 * A value's identity: its text with every record's fields in one order (sorted), so that two values equal by value
 * are one, whatever order they were written in (a record's values, a texture's fields), while a host instance (an
 * image source) keeps its own identity without retaining it. Lists keep their order: in the description an order is
 * data (the actors, a colour's channels).
 */
export const modelRecordIdentity = (value: unknown): string => JSON.stringify(value, (_, item: unknown) => {
  if (!isRecord(item)) return item;
  const prototype: unknown = Object.getPrototypeOf(item);
  if (prototype !== Object.prototype && prototype !== null) return instanceTag(item);
  return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
});
