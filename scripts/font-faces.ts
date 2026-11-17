// Writes src/react/fonts.css from FONT_FILES, so the faces are declared once; tests/fontFaces.test.ts refuses drift.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { FONT_FACES_STYLESHEET, fontFaceRules } from './fontFaceRules.ts';

await writeFile(fileURLToPath(new URL(`../${FONT_FACES_STYLESHEET}`, import.meta.url)), fontFaceRules());
console.log(`Wrote ${FONT_FACES_STYLESHEET}.`);
