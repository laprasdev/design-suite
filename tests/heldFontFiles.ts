// Prints each font file the suite holds, as the host it runs in resolves the package: the path its `./fonts/*` export
// names, and the path `fontFileUrl` reads it from. It imports nothing but the package and Node, so a test can copy it
// into a host that installs the package and run it there.
//   node [--conditions=source] heldFontFiles.ts <engine checkout>
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { FONT_FILES, FONT_HOLDERS } from '@looms/bloom-design/fonts';
import { fontFileUrl } from '@looms/bloom-design/fontFiles';

const [, , engineCheckout] = argv;
if (engineCheckout === undefined) throw new Error('Name the engine checkout: node heldFontFiles.ts <engine checkout>.');

const held = FONT_FILES.filter(face => face.holder === FONT_HOLDERS.suite);
console.log(JSON.stringify(held.map(face => ({
  exported: fileURLToPath(import.meta.resolve(`@looms/bloom-design/fonts/${face.file}`)),
  read: fileURLToPath(fontFileUrl(face, engineCheckout)),
}))));
