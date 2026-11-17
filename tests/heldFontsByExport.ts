// Each font file the suite holds, as a host in `cwd` resolves it: through `./fontFiles`, and through `./fonts/*`.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {
  OTHER_FIELDS, holdsListOf, holdsNonEmptyString, holdsShape, refusalBy, type FieldCheck, type ShapeOf,
} from '../scripts/build/fieldChecks.ts';

/** The condition that resolves the package's exports to its source rather than its build. */
export const SOURCE_CONDITION = '--conditions=source';
const PACKAGE = '@looms/bloom-design';
const HELD_FONT_SHAPE = Object.freeze({ exported: holdsNonEmptyString, read: holdsNonEmptyString });
/** A held file: the path its `./fonts/*` export resolves to, and the path `fontFileUrl` reads it from. */
export type HeldFont = ShapeOf<typeof HELD_FONT_SHAPE>;
const holdsHeldFonts: FieldCheck<readonly HeldFont[]> =
  holdsListOf(holdsShape(HELD_FONT_SHAPE, OTHER_FIELDS.refused));
const RESOLVE = `
const { FONT_FILES, FONT_HOLDERS } = await import('${PACKAGE}/fonts');
const { fontFileUrl } = await import('${PACKAGE}/fontFiles');
const { fileURLToPath, pathToFileURL } = await import('node:url');
const held = FONT_FILES.filter(face => face.holder === FONT_HOLDERS.suite);
console.log(JSON.stringify(held.map(face => ({
  exported: fileURLToPath(import.meta.resolve('${PACKAGE}/fonts/' + face.file)),
  read: fileURLToPath(fontFileUrl(face, { [FONT_HOLDERS.engine]: pathToFileURL('/engine/') })),
}))));`;

export function heldFontsByExport(cwd: string, conditions: readonly string[]): readonly HeldFont[] {
  const resolved = execFileSync(process.execPath, [...conditions, '--input-type=module', '-e', RESOLVE],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const output: unknown = JSON.parse(resolved);
  holdsHeldFonts(output, '', refusalBy(reason => assert.fail(`the held fonts: ${reason}.`), 'the resolved fonts'));
  return output;
}
