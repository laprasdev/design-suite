// A temporary bridge: the base branch's size baseline, read with the fields the format before this one recorded
// dropped. That format held each file's import lines in its entry (`importLines`) and in each allowance (`from`,
// `to`), until the allowance rule measured them in both files. Only scripts/baseline-gate.ts reads it, for the base
// branch's baseline, since a branch cannot change its base; every other reader refuses those fields by name.
// Removed once design-suite pull request 13 and infinite-state-machine's `chore/suite-typescript-entries` have landed
// and no base branch holds those fields (`BaselineReading.parseBase` in scripts/baseline-gate.ts leaves once
// `parseBaseAllocationBaseline` in scripts/baseline/allocationBaseline.ts is gone too).
import { isRecord } from '../../src/valueChecks.ts';
import { parseBaseline } from './baselineFile.ts';
import type { SizeBaseline } from './limits.ts';

const RETIRED = Object.freeze({ entry: ['importLines'], allowance: ['from', 'to'] });

/** `value` without `fields`, when it is a record; any other value is left for the reader to refuse. */
const without = (fields: readonly string[]) => (value: unknown): unknown =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter(([field]) => !fields.includes(field))) : value;

/** A base branch's size baseline from its decoded JSON, each retired field dropped and every other field read. */
export function parseWithoutRetiredFields(value: unknown, file: string): SizeBaseline {
  if (!isRecord(value)) return parseBaseline(value, file);
  const { files, allowances } = value;
  const entries = isRecord(files)
    ? Object.fromEntries(Object.entries(files).map(([path, entry]) => [path, without(RETIRED.entry)(entry)]))
    : files;
  const grants = Array.isArray(allowances) ? allowances.map(without(RETIRED.allowance)) : allowances;
  return parseBaseline({ ...value, files: entries, allowances: grants }, file);
}
