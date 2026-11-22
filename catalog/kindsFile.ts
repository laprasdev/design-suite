// The form of kinds.json, the hand-kept map from each kind to the members that implement it in every source.
import {
  OTHER_FIELDS, entryAt, fieldAt, fieldsHolding, holdsNonEmptyString, holdsOptional, holdsRecordOf, holdsShape,
  holdsString, holdsStringList, refusalBy, type FieldCheck, type ShapeOf,
} from '../scripts/build/fieldChecks.ts';

/** The sources a kind names its members in; each one is a set the scan finds. */
export const SOURCE_KEYS = ['unity', 'web', 'kit', 'core', 'skinForms', 'containerForms'] as const;
export type SourceKey = typeof SOURCE_KEYS[number];
/** Every list a kinds.json row may hold: the sources, and the folders its web members live in. */
const LIST_FIELDS = [...SOURCE_KEYS, 'webDirs'] as const;

/** A kind's row: the data that chooses it, each list it names, and the web member it shows first. */
const KIND_ROW_SHAPE = Object.freeze({
  data: holdsNonEmptyString,
  webFirst: holdsOptional(holdsString),
  ...fieldsHolding(LIST_FIELDS, holdsOptional(holdsStringList)),
});
export type KindRow = ShapeOf<typeof KIND_ROW_SHAPE>;
const holdsKindRow: FieldCheck<KindRow> = holdsShape(KIND_ROW_SHAPE, OTHER_FIELDS.ignored);

/** The field of kinds.json that holds each kind's row. */
const ROWS_FIELD = 'kinds';
const KINDS_FILE_SHAPE = Object.freeze({ [ROWS_FIELD]: holdsRecordOf(holdsKindRow) });
export type KindsFile = ShapeOf<typeof KINDS_FILE_SHAPE>;
/** The place in kinds.json of `kind`'s list of members in `source`, as a refusal names it. */
export const kindListAt = (kind: string, source: SourceKey): string => fieldAt(entryAt(ROWS_FIELD, kind), source);
const holdsKindsFile: FieldCheck<KindsFile> = holdsShape(KINDS_FILE_SHAPE, OTHER_FIELDS.ignored);

/** kinds.json's text as its record, refusing by place what does not hold the form. */
export function parseKindsFile(text: string): KindsFile {
  const file: unknown = JSON.parse(text);
  holdsKindsFile(file, '', refusalBy(reason => {
    throw new Error(`kinds.json: ${reason}.`);
  }, 'the file'));
  return file;
}
