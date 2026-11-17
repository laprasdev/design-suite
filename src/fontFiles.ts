// FONT FILES — where a host on disk reads each face of `FONT_FILES`, as a file URL. The files this package holds sit
// in `fonts/` beside this module, in its source and in its build alike, which is the folder the `./fonts/*` export
// names; only the engine repository's checkout is the host's to name. Imported by nothing else in the suite, so the
// build keeps this module in its own entry file and `import.meta.url` stays beside the built fonts.
import { FONT_HOLDERS, type FontFile, type FontHolder } from "./fonts.ts";

/** The folders a host names for the holders, as file URLs ending in `/`: the engine repository's checkout. */
export type FontHolderRoots = Readonly<Record<typeof FONT_HOLDERS.engine, URL>>;
const FOLDER_END = "/";
const HELD_FONTS = new URL(`fonts${FOLDER_END}`, import.meta.url);
/** Where the engine repository keeps its font files under its checkout. */
const ENGINE_FONTS = `packages/com.bloom.state-machine/Runtime/Interface/Fonts${FOLDER_END}`;

function engineFonts(roots: FontHolderRoots): URL {
  const checkout = roots[FONT_HOLDERS.engine];
  if (!checkout.pathname.endsWith(FOLDER_END)) {
    throw new Error(`The engine checkout ${checkout.href} names a file, not a folder: end it with "${FOLDER_END}".`);
  }
  return new URL(ENGINE_FONTS, checkout);
}
const HOLDER_FOLDERS: Readonly<Record<FontHolder, (roots: FontHolderRoots) => URL>> = Object.freeze({
  [FONT_HOLDERS.suite]: () => HELD_FONTS,
  [FONT_HOLDERS.engine]: engineFonts,
});

/** The file `face` is read from, under the folders the host names. */
export const fontFileUrl = (face: FontFile, roots: FontHolderRoots): URL =>
  new URL(face.file, HOLDER_FOLDERS[face.holder](roots));
