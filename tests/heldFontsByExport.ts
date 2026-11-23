// Each font file the suite holds, as a host resolves it: through `./fontFiles`, and through `./fonts/*`. The host is
// the folder `heldFontFiles.ts` runs from, because a bare specifier resolves from the importing file.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  OTHER_FIELDS, holdsListOf, holdsNonEmptyString, holdsShape, refusalBy, type FieldCheck, type ShapeOf,
} from '../scripts/build/fieldChecks.ts';

/** The condition that resolves the package's exports to its source rather than its build. */
export const SOURCE_CONDITION = '--conditions=source';
/** A font folder a host would name; no held face is read from it. */
export const HOST_FONT_FOLDER = '/fonts';
/** The program that prints the held fonts; a host other than this package runs a copy of it from its own folder. */
export const HELD_FONT_FILES = fileURLToPath(new URL('heldFontFiles.ts', import.meta.url));
const HELD_FONT_SHAPE = Object.freeze({ exported: holdsNonEmptyString, read: holdsNonEmptyString });
/** A held file: the path its `./fonts/*` export resolves to, and the path `fontFileUrl` reads it from. */
export type HeldFont = ShapeOf<typeof HELD_FONT_SHAPE>;
const holdsHeldFonts: FieldCheck<readonly HeldFont[]> =
  holdsListOf(holdsShape(HELD_FONT_SHAPE, OTHER_FIELDS.refused));

/** Runs `program`, a copy of `HELD_FONT_FILES` or the file itself, and reads the held fonts it prints. */
export function heldFontsByExport(program: string, conditions: readonly string[]): readonly HeldFont[] {
  const printed = execFileSync(process.execPath, [...conditions, program, HOST_FONT_FOLDER],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const output: unknown = JSON.parse(printed);
  holdsHeldFonts(output, '', refusalBy(reason => assert.fail(`the held fonts: ${reason}.`), 'the printed fonts'));
  return output;
}
