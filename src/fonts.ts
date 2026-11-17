// FONTS — every face the suite declares, each once, at the one route every host serves. This repository is public:
// it ships Inter (SIL Open Font License, src/fonts/OFL.txt) and never SF Pro, whose files stay in the private engine
// repository and are served on the same route by each host. A host on disk finds each file through `./fontFiles`.

/** The path every host serves the files of `FONT_FILES` on. */
export const FONT_ROUTE = "/fonts/";
/** Every URL on the route, as a bundler's `external` pattern: the stylesheet names the files, a host serves them. */
export const FONT_ROUTE_FILES = `${FONT_ROUTE}*`;
export const DISPLAY_FONT_FAMILY = "Bloom SF Pro Display";
export const READING_FONT_FAMILY = "Bloom Inter";

/** Who holds a face's file: this package (`./fonts/*`), or the private engine repository. */
export const FONT_HOLDERS = Object.freeze({ suite: "suite", engine: "engine" });
export type FontHolder = typeof FONT_HOLDERS[keyof typeof FONT_HOLDERS];
/** Each font file format: the name a stylesheet's `format()` gives it, and the media type a host serves it as. */
export const FONT_FORMATS = Object.freeze({
  opentype: Object.freeze({ css: "opentype", mediaType: "font/otf" }),
  woff2: Object.freeze({ css: "woff2", mediaType: "font/woff2" }),
});
export type FontFormat = typeof FONT_FORMATS[keyof typeof FONT_FORMATS];
/** A face's weight: one cut, or the range a variable file spans. */
export interface FontWeight { readonly min: number; readonly max: number }
export interface FontFile {
  readonly family: string;
  readonly file: string;
  readonly format: FontFormat;
  readonly weight: FontWeight;
  readonly holder: FontHolder;
  /** The path the file is served at: `file` on `FONT_ROUTE`. */
  readonly route: string;
}

const fontFile = (face: Omit<FontFile, "route">): FontFile =>
  Object.freeze({ ...face, route: `${FONT_ROUTE}${face.file}` });
const DISPLAY_CUTS = Object.freeze([["Regular", 400], ["Medium", 500], ["Semibold", 600], ["Bold", 700]] as const);
export const FONT_FILES: readonly FontFile[] = Object.freeze([
  ...DISPLAY_CUTS.map(([cut, weight]) => fontFile({
    family: DISPLAY_FONT_FAMILY, file: `SF-Pro-Display-${cut}.otf`, format: FONT_FORMATS.opentype,
    weight: Object.freeze({ min: weight, max: weight }), holder: FONT_HOLDERS.engine,
  })),
  fontFile({
    family: READING_FONT_FAMILY, file: "InterVariable-Latin.woff2", format: FONT_FORMATS.woff2,
    weight: Object.freeze({ min: 100, max: 900 }), holder: FONT_HOLDERS.suite,
  }),
]);
/** Every face of `FONT_FILES` by the path it is served at; a path that is not here is no font. */
export const FONTS_BY_ROUTE: ReadonlyMap<string, FontFile> = new Map(FONT_FILES.map(face => [face.route, face]));
