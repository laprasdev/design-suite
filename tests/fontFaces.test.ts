import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { FONT_FACES_STYLESHEET, FONT_FILES, FONT_HOLDERS, READING_FONT_FAMILY, fontFaceRules } from '../src/fonts.ts';
import { THEME_TYPOGRAPHY } from '../src/theme.ts';

const at = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
/** Where the files this package holds live in its source, beside the licence they ship under. */
const SUITE_FONTS = 'src/fonts';
const LICENCE = 'OFL.txt';

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
  it('lead the reading stack with the reading face', () => {
    assert.ok(THEME_TYPOGRAPHY.reading.startsWith(`"${READING_FONT_FAMILY}",`), THEME_TYPOGRAPHY.reading);
  });
});
