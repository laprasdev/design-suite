// The form of kinds.json, the hand-kept map from each kind to the members that implement it in every source.
import {
  OTHER_FIELDS, holdsOptional, holdsRecordOf, holdsShape, holdsShapeWithFields, holdsString, holdsStringList,
  refusalBy, type Checked, type FieldCheck, type ShapeOf,
} from '../scripts/fieldChecks.ts';

/** The sources a kind names its members in; each one is a set the scan finds. */
export const SOURCE_KEYS = ['unity', 'web', 'kit', 'core', 'skinForms', 'containerForms'] as const;
export type SourceKey = typeof SOURCE_KEYS[number];
/** Every list a kinds.json row may hold: the sources, and the folders its web members live in. */
const LIST_FIELDS = [...SOURCE_KEYS, 'webDirs'] as const;

/** A kind's row: each list it names, and the web member it shows first; its notes and data are not read here. */
const holdsKindRow = holdsShapeWithFields(
  Object.freeze({ webFirst: holdsOptional(holdsString) }),
  { fields: LIST_FIELDS, check: holdsOptional(holdsStringList) },
  OTHER_FIELDS.ignored,
);
export type KindRow = Checked<typeof holdsKindRow>;

const KINDS_FILE_SHAPE = Object.freeze({ kinds: holdsRecordOf(holdsKindRow) });
export type KindsFile = ShapeOf<typeof KINDS_FILE_SHAPE>;
const holdsKindsFile: FieldCheck<KindsFile> = holdsShape(KINDS_FILE_SHAPE, OTHER_FIELDS.ignored);

/** kinds.json's text as its record, refusing by place what does not hold the form. */
export function parseKindsFile(text: string): KindsFile {
  const file: unknown = JSON.parse(text);
  holdsKindsFile(file, '', refusalBy(reason => {
    throw new Error(`kinds.json: ${reason}.`);
  }, 'the file'));
  return file;
}
