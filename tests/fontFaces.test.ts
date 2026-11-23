import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FONT_FILES, FONT_FORMATS, FONT_HOLDERS, FONTS_BY_ROUTE, READING_FONT_FAMILY, type FontFormat,
} from '../src/fonts.ts';
import { fontFileUrl } from '../src/fontFiles.ts';
import { FONT_FACES_STYLESHEET, fontFaceRules } from '../scripts/fontFaceRules.ts';
import { THEME_TYPOGRAPHY } from '../src/theme.ts';
import { HOST_FONT_FOLDER, HELD_FONT_FILES, SOURCE_CONDITION, heldFontsByExport } from './heldFontsByExport.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LICENCE = 'OFL.txt';
/** The first bytes a file of each format starts with. */
const SIGNATURES: ReadonlyMap<FontFormat, string> =
  new Map<FontFormat, string>([[FONT_FORMATS.opentype, 'OTTO'], [FONT_FORMATS.woff2, 'wOF2']]);
const held = FONT_FILES.filter(face => face.holder === FONT_HOLDERS.suite);
const hostHeld = FONT_FILES.filter(face => face.holder === FONT_HOLDERS.host);
/** Folder names a path may hold that a URL escapes or ends on. */
const AWKWARD_FOLDERS = ['/fonts', '/fonts/', '/fonts 100%', '/fonts#1?a'] as const;
/** Font folders that are not absolute, which the URL path setter would otherwise root at `/`. */
const RELATIVE_FOLDERS = ['../fonts', 'fonts', ''] as const;

describe('the font faces', () => {
  it('are the stylesheet `npm run fonts` writes, unchanged', () => {
    assert.equal(readFileSync(path.join(ROOT, FONT_FACES_STYLESHEET), 'utf8'), fontFaceRules());
  });
  it('ship every file the suite holds, in its format, with its licence', () => {
    assert.ok(held.length > 0, 'the suite holds no font file');
    for (const face of held) {
      const file = fileURLToPath(fontFileUrl(face, HOST_FONT_FOLDER));
      assert.equal(readFileSync(file).subarray(0, 4).toString('latin1'), SIGNATURES.get(face.format), file);
      assert.ok(existsSync(path.join(path.dirname(file), LICENCE)), `${LICENCE} is missing beside ${file}`);
    }
  });
  it('read each host face under the font folder the host names, as the folder it is on disk', () => {
    assert.ok(hostHeld.length > 0, 'the host holds no font file');
    for (const folderPath of AWKWARD_FOLDERS) {
      const folder = path.join(folderPath, path.sep);
      for (const face of hostHeld) {
        const file = fileURLToPath(fontFileUrl(face, folderPath));
        assert.ok(file.startsWith(folder) && file.endsWith(`${path.sep}${face.file}`), `${folderPath}: ${file}`);
      }
    }
  });
  it('refuse a host font folder that is not absolute, naming it', () => {
    for (const folderPath of RELATIVE_FOLDERS) {
      for (const face of hostHeld) {
        const refusal = new RegExp(`absolute folder path.*given "${folderPath}"`);
        assert.throws(() => fontFileUrl(face, folderPath), { message: refusal });
      }
    }
  });
  it('are read from the file the package exports each one as', () => {
    const read = heldFontsByExport(HELD_FONT_FILES, [SOURCE_CONDITION]);
    assert.equal(read.length, held.length);
    for (const font of read) assert.equal(font.read, font.exported);
  });
  it('are found by the path each is served at, and no other', () => {
    assert.deepEqual([...FONTS_BY_ROUTE.values()], FONT_FILES);
    for (const face of FONT_FILES) assert.equal(FONTS_BY_ROUTE.get(face.route), face);
  });
  it('lead the reading stack with the reading face', () => {
    assert.ok(THEME_TYPOGRAPHY.reading.startsWith(`"${READING_FONT_FAMILY}",`), THEME_TYPOGRAPHY.reading);
  });
});
