// The `@font-face` rules of the suite's stylesheet, written from FONT_FILES so each face is declared once. Build-time
// only: `npm run fonts` writes them and tests/fontFaces.test.ts refuses drift, so they stay out of the package's API.
import { FONT_FILES, type FontWeight } from '../src/fonts.ts';

/** The stylesheet `npm run fonts` writes, relative to the package root. */
export const FONT_FACES_STYLESHEET = 'src/react/fonts.css';
const cssWeight = ({ min, max }: FontWeight) => (min === max ? String(min) : `${min} ${max}`);
/** The `@font-face` rules of `FONT_FACES_STYLESHEET`, one per file of `FONT_FILES`. */
export function fontFaceRules(): string {
  const header = '/* Written by `npm run fonts` from src/fonts.ts: edit FONT_FILES there, never this file. */\n';
  return header + FONT_FILES.map(face => `@font-face { font-family:"${face.family}"; `
    + `src:url("${face.route}") format("${face.format.css}"); `
    + `font-weight:${cssWeight(face.weight)}; font-display:swap; }\n`).join('');
}
