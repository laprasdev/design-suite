// FONT FILES — where a host on disk reads each face of `FONT_FILES`, as a file URL. The files this package holds sit
// in `fonts/` beside this module, in its source and in its build alike, which is the folder the `./fonts/*` export
// names; the folder holding the faces this package does not ship is the host's to name, as an absolute folder path.
// Imported by nothing else in the suite, so the build keeps this module in its own entry file and `import.meta.url`
// stays beside the built fonts. A host that bundles this module moves `import.meta.url` away from those fonts, so it
// reads the suite's faces from its own copies, never through `fontFileUrl`. No Node import, so the suite's own type
// check, which has no Node types, reads it.
import { FONT_HOLDERS, type FontFile, type FontHolder } from "./fonts.ts";

const FOLDER_END = "/";
const FILE_ROOT = "file:///";
/**
 * The URL path setter encodes what a path holds except `%`, which it keeps as an escape, and `\`, which it turns into
 * `/`. It also roots every path at `/`, so a folder that does not start there is refused rather than read elsewhere.
 */
const PERCENT = "%";
const ENCODED_PERCENT = "%25";
const HELD_FONTS = new URL(`fonts${FOLDER_END}`, import.meta.url);

/** An absolute folder path as the file URL its files resolve under, which ends in `/`. */
function folderUrl(folder: string): URL {
  if (!folder.startsWith(FOLDER_END)) {
    throw new Error(
      `The font folder must be an absolute folder path, starting with "${FOLDER_END}"; given "${folder}".`);
  }
  const url = new URL(FILE_ROOT);
  url.pathname = folder.replaceAll(PERCENT, ENCODED_PERCENT);
  if (!url.pathname.endsWith(FOLDER_END)) url.pathname += FOLDER_END;
  return url;
}
const HOLDER_FOLDERS: Readonly<Record<FontHolder, (fontFolder: string) => URL>> = Object.freeze({
  [FONT_HOLDERS.suite]: () => HELD_FONTS,
  [FONT_HOLDERS.host]: folderUrl,
});

/** The file `face` is read from, given the host's font folder as an absolute folder path. */
export const fontFileUrl = (face: FontFile, fontFolder: string): URL =>
  new URL(face.file, HOLDER_FOLDERS[face.holder](fontFolder));
