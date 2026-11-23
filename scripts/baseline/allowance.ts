// An allowance in a baseline whose numbers only fall: a record naming the baselined file (`path`) and the grant that
// admits its rise above the base branch's baseline. Each baseline states its grant shape and when one grant covers a
// risen file; `allowanceUnaccounted` holds every allowed baseline to the rule that only an allowance the base branch
// lacks may raise a file.
import { isRecord } from '../../src/valueChecks.ts';
import {
  OTHER_FIELDS, holdsListOf, holdsNonEmptyString, holdsRecordOf, holdsShape, type FieldCheck, type ShapeOf,
} from '../build/fieldChecks.ts';
import { BASE_BRANCH } from './baseBranch.ts';
import {
  LIST, baselineModule, filesJson, holdsNumbers, jsonBlock, type BaselinedFiles, type BaselineModule,
  type FileNumbers, type NumbersOf,
} from './baselinedFiles.ts';

/** Every allowance names the baselined file whose rise it accounts for. */
export interface Allowance {
  readonly path: string;
}

/** A baseline whose numbers only fall unless an entry in `allowances` admits a rise. */
export interface AllowedBaseline<Numbers extends FileNumbers, Grant extends Allowance> {
  readonly files: BaselinedFiles<Numbers>;
  readonly allowances: readonly Grant[];
}

/** The field every allowance holds, checked here once: the baselined file it names. */
const PATH_SHAPE = Object.freeze({ path: holdsNonEmptyString });
type GrantShape = Readonly<Record<string, FieldCheck<unknown>>>;
/** An allowance record of a baseline's grant shape: its file in `path` and the grant's own fields. */
export type AllowanceOf<Shape extends GrantShape> = ShapeOf<typeof PATH_SHAPE & Shape>;

/** One allowance record: names its file in `path`, holds the grant's `shape`, and no other field. */
export const holdsAllowance = <Shape extends GrantShape>(shape: Shape): FieldCheck<AllowanceOf<Shape>> =>
  holdsShape({ ...PATH_SHAPE, ...shape }, OTHER_FIELDS.refused);

/** A baseline's `allowances` list: each entry an allowance record of the grant's `shape`. */
export const holdsAllowances = <Shape extends GrantShape>(shape: Shape): FieldCheck<readonly AllowanceOf<Shape>[]> =>
  holdsListOf(holdsAllowance(shape));

/** Formats a baseline's `allowances` list, one JSON record to a line. */
export const allowanceListJson = <Grant extends Allowance>(allowances: readonly Grant[]): string =>
  jsonBlock(allowances.map(allowance => JSON.stringify(allowance)), LIST);

/** The allowances of `allowances` whose files remain in `files`. */
export const keptAllowances = <Numbers extends FileNumbers, Grant extends Allowance>(
  files: BaselinedFiles<Numbers>,
  allowances: readonly Grant[],
): Grant[] => allowances.filter(allowance => Object.hasOwn(files, allowance.path));

/** One risen file and a new allowance `grant` candidate to check against `from` (base) and `to` (head). */
export interface AllowanceCheck<Numbers extends FileNumbers, Grant extends Allowance> {
  readonly root: string;
  readonly file: string;
  readonly from: Numbers;
  readonly to: Numbers;
  readonly grant: Grant;
}

export type AllowanceRefusal<Numbers extends FileNumbers, Grant extends Allowance> =
  (check: AllowanceCheck<Numbers, Grant>) => string | undefined;

const canonicalJson = (value: unknown): string => JSON.stringify(value, (_key, entry: unknown) =>
  isRecord(entry) ? Object.fromEntries(Object.keys(entry).sort().map(field => [field, entry[field]])) : entry);

/**
 * Why no allowance `BASE_BRANCH` lacks raises `file` from `from` in an `AllowedBaseline`: refuses when no allowance
 * `BASE_BRANCH` lacks names `file`, and otherwise holds each new allowance for `file` to `refusal`.
 */
export const allowanceUnaccounted = <
  Numbers extends FileNumbers,
  Baseline extends AllowedBaseline<Numbers, Allowance>,
>(refusal: AllowanceRefusal<Numbers, Baseline['allowances'][number]>) =>
  (root: string, base: Baseline, head: Baseline, file: string, from: Numbers): string | undefined => {
    const before = new Set(base.allowances.map(canonicalJson));
    const grants = head.allowances
      .filter(allowance => allowance.path === file && !before.has(canonicalJson(allowance)));
    if (!grants.length) return `no allowance ${BASE_BRANCH} lacks raises it`;
    let why: string | undefined;
    for (const grant of grants) {
      const refused = refusal({ root, file, from, to: head.files[file], grant });
      if (!refused) return undefined;
      why = refused;
    }
    return why;
  };

const DECISION_ALLOWANCE_SHAPE = Object.freeze({ decision: holdsNonEmptyString });
/** An allowance that admits the head's baselined numbers on `path`, citing the owner's `decision`. */
export type DecisionAllowance = AllowanceOf<typeof DECISION_ALLOWANCE_SHAPE>;

export type AllowedFilesBaseline<Kind extends string> = AllowedBaseline<NumbersOf<Kind>, DecisionAllowance>;

/** Builds the path, kinds, rise check, parser, reader and formatter for a numeric baseline with decision allowances. */
export const allowedFilesBaseline = <Kind extends string>(
  gate: string,
  file: string,
  kinds: readonly Kind[],
): BaselineModule<Kind, AllowedFilesBaseline<Kind>> => baselineModule(
  gate,
  file,
  kinds,
  holdsShape({
    files: holdsRecordOf(holdsNumbers(kinds)),
    allowances: holdsAllowances(DECISION_ALLOWANCE_SHAPE),
  }, OTHER_FIELDS.refused),
  baseline => ({ files: filesJson(baseline.files), allowances: allowanceListJson(baseline.allowances) }),
);
