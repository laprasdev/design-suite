// FONTS — every face the suite declares, each once, at the one route every host serves. This repository is public:
// it ships Inter (SIL Open Font License, src/fonts/OFL.txt) and never SF Pro, whose files stay in the private engine
// repository and are served on the same route by each host.

/** The path every host serves the files of `FONT_FILES` on. */
export const FONT_ROUTE = "/fonts/";
/** Every URL on the route, as a bundler's `external` pattern: the stylesheet names the files, a host serves them. */
export const FONT_ROUTE_FILES = `${FONT_ROUTE}*`;
export const DISPLAY_FONT_FAMILY = "Bloom SF Pro Display";
export const READING_FONT_FAMILY = "Bloom Inter";

/** Who holds a face's file: this package (`./fonts/*`), or the private engine repository. */
export const FONT_HOLDERS = Object.freeze({ suite: "suite", engine: "engine" });
export type FontHolder = typeof FONT_HOLDERS[keyof typeof FONT_HOLDERS];
/** A face's weight: one cut, or the range a variable file spans. */
export interface FontWeight { readonly min: number; readonly max: number }
export interface FontFile {
  readonly family: string;
  readonly file: string;
  readonly format: string;
  readonly weight: FontWeight;
  readonly holder: FontHolder;
}

const DISPLAY_CUTS = Object.freeze([["Regular", 400], ["Medium", 500], ["Semibold", 600], ["Bold", 700]] as const);
export const FONT_FILES: readonly FontFile[] = Object.freeze([
  ...DISPLAY_CUTS.map(([cut, weight]) => Object.freeze({
    family: DISPLAY_FONT_FAMILY, file: `SF-Pro-Display-${cut}.otf`, format: "opentype",
    weight: Object.freeze({ min: weight, max: weight }), holder: FONT_HOLDERS.engine,
  })),
  Object.freeze({
    family: READING_FONT_FAMILY, file: "InterVariable-Latin.woff2", format: "woff2",
    weight: Object.freeze({ min: 100, max: 900 }), holder: FONT_HOLDERS.suite,
  }),
]);

/** The stylesheet `npm run fonts` writes, relative to the package root. */
export const FONT_FACES_STYLESHEET = "src/react/fonts.css";
const cssWeight = ({ min, max }: FontWeight) => (min === max ? String(min) : `${min} ${max}`);
/** The `@font-face` rules of `FONT_FACES_STYLESHEET`, one per file of `FONT_FILES`. */
export function fontFaceRules(): string {
  const header = "/* Written by `npm run fonts` from src/fonts.ts: edit FONT_FILES there, never this file. */\n";
  return header + FONT_FILES.map(face => `@font-face { font-family:"${face.family}"; `
    + `src:url("${FONT_ROUTE}${face.file}") format("${face.format}"); `
    + `font-weight:${cssWeight(face.weight)}; font-display:swap; }\n`).join("");
}
