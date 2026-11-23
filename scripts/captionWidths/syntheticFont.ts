// Writes a minimal synthetic OpenType face for generator tests, with no consumer font on disk.
import { writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

export function writeSyntheticFont(file: string): void {
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: new opentype.Path() });
  const space = new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new opentype.Path() });
  const glyphA = new opentype.Glyph({ name: 'A', unicode: 65, advanceWidth: 600, path: new opentype.Path() });
  const glyphB = new opentype.Glyph({ name: 'B', unicode: 66, advanceWidth: 700, path: new opentype.Path() });
  const font = new opentype.Font({
    familyName: 'Fixture',
    styleName: 'SemiBold',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: [notdef, space, glyphA, glyphB],
  });
  writeFileSync(file, Buffer.from(font.toArrayBuffer()));
}
