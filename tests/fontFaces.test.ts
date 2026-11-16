import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FONT_FACES_STYLESHEET, FONT_FILES, FONT_HOLDERS, READING_FONT_FAMILY, fontFaceRules, fontHolderFolder,
  type FontHolderRoots,
} from '../src/fonts.ts';
import {
  OTHER_FIELDS, entryAt, holdsNonEmptyString, holdsRecord, holdsShape, refusalBy, type FieldCheck, type ShapeOf,
} from '../scripts/build/fieldChecks.ts';
import { THEME_TYPOGRAPHY } from '../src/theme.ts';

const at = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
/** Where the files this package holds live in its source, beside the licence they ship under. */
const SUITE_FONTS = 'src/fonts';
const LICENCE = 'OFL.txt';
/** The package's export of the files it holds, which names the folder they are built into. */
const HELD_FONTS_EXPORT = './fonts/*';
const MANIFEST_SHAPE = Object.freeze({ exports: holdsRecord });
const holdsManifest: FieldCheck<ShapeOf<typeof MANIFEST_SHAPE>> = holdsShape(MANIFEST_SHAPE, OTHER_FIELDS.ignored);
const BUILT_EXPORT_SHAPE = Object.freeze({ default: holdsNonEmptyString });
const holdsBuiltExport: FieldCheck<ShapeOf<typeof BUILT_EXPORT_SHAPE>> =
  holdsShape(BUILT_EXPORT_SHAPE, OTHER_FIELDS.ignored);
/** A root for each holder, each distinct, as a host would pass them. */
const ROOTS: FontHolderRoots = Object.freeze({ [FONT_HOLDERS.suite]: '/suite', [FONT_HOLDERS.engine]: '/engine' });

describe('the font faces', () => {
  it('are the stylesheet `npm run fonts` writes, unchanged', () => {
    assert.equal(readFileSync(at(FONT_FACES_STYLESHEET), 'utf8'), fontFaceRules());
  });
  it('ship every file the suite holds, with its licence', () => {
    const held = FONT_FILES.filter(face => face.holder === FONT_HOLDERS.suite);
    assert.ok(held.length > 0, 'the suite holds no font file');
    for (const face of held) assert.ok(existsSync(at(`${SUITE_FONTS}/${face.file}`)), `${face.file} is missing`);
    assert.ok(existsSync(at(`${SUITE_FONTS}/${LICENCE}`)), `${LICENCE} is missing`);
  });
  it('sit in each holder\'s folder under the root a host passes for it', () => {
    for (const holder of Object.values(FONT_HOLDERS)) {
      const folder = fontHolderFolder(holder, ROOTS);
      assert.ok(folder.startsWith(`${ROOTS[holder]}/`), `${holder}: ${folder}`);
    }
  });
  it('are built into the folder the package exports them from', () => {
    const refuse = refusalBy(reason => assert.fail(`package.json: ${reason}.`), 'the manifest');
    const manifest: unknown = JSON.parse(readFileSync(at('package.json'), 'utf8'));
    holdsManifest(manifest, '', refuse);
    const held: unknown = manifest.exports[HELD_FONTS_EXPORT];
    holdsBuiltExport(held, entryAt('exports', HELD_FONTS_EXPORT), refuse);
    const here = Object.freeze({ [FONT_HOLDERS.suite]: '.', [FONT_HOLDERS.engine]: '.' });
    assert.equal(held.default, `${fontHolderFolder(FONT_HOLDERS.suite, here)}/*`);
  });
  it('lead the reading stack with the reading face', () => {
    assert.ok(THEME_TYPOGRAPHY.reading.startsWith(`"${READING_FONT_FAMILY}",`), THEME_TYPOGRAPHY.reading);
  });
});
