// The manifest owns the public entrypoints. Build only inside this package. This folder ships with the package
// (package.json `files`), so the build and every file it imports from scripts/ live in it.
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  OTHER_FIELDS, entryAt, holdsNonEmptyString, holdsRecord, holdsShape, refusalBy, type FieldCheck, type ShapeOf,
} from './fieldChecks.ts';
import { isString } from '../../src/valueChecks.ts';
import { FONT_ROUTE_FILES } from '../../src/fonts.ts';

/** An export whose source ends so is a folder of files shipped as they are, such as the font files. */
const FOLDER_PATTERN = '/*';

/** An export that names its source and its built file; an export given as a bare path is a pattern, not built. */
const EXPORT_TARGET_SHAPE = Object.freeze({ source: holdsNonEmptyString, default: holdsNonEmptyString });
type ExportTarget = ShapeOf<typeof EXPORT_TARGET_SHAPE>;
const holdsExportTarget: FieldCheck<ExportTarget> = holdsShape(EXPORT_TARGET_SHAPE, OTHER_FIELDS.ignored);
const MANIFEST_SHAPE = Object.freeze({ name: holdsNonEmptyString, version: holdsNonEmptyString, exports: holdsRecord });
const holdsManifest: FieldCheck<ShapeOf<typeof MANIFEST_SHAPE>> = holdsShape(MANIFEST_SHAPE, OTHER_FIELDS.ignored);
const refuse = refusalBy(reason => {
  throw new Error(`package.json: ${reason}.`);
}, 'the manifest');

const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest: unknown = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
holdsManifest(manifest, '', refuse);
const exportEntries = Object.entries(manifest.exports);
const targets = exportEntries.flatMap(([subpath, value]): ExportTarget[] => {
  if (isString(value)) return [];
  holdsExportTarget(value, entryAt('exports', subpath), refuse);
  return [value];
});
const entryPoints = Object.fromEntries(
  targets.filter(entry => /\.tsx?$/.test(entry.source)).map(entry => [
    relative('dist', entry.default).replace(/\.js$/, ''),
    resolve(root, entry.source),
  ]),
);
const outdir = resolve(root, 'dist');
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints,
  outdir,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*', 'lucide-react', 'three', 'three/*'],
  logLevel: 'warning',
});
for (const entry of targets.filter(item => item.source.endsWith('.css'))) {
  await build({
    absWorkingDir: root,
    entryPoints: [resolve(root, entry.source)],
    outfile: resolve(root, entry.default),
    bundle: true,
    external: [FONT_ROUTE_FILES],
    logLevel: 'warning',
  });
}
for (const entry of targets.filter(item => item.source.endsWith(FOLDER_PATTERN))) {
  await cp(resolve(root, dirname(entry.source)), resolve(root, dirname(entry.default)), { recursive: true });
}
console.log(`Built ${manifest.name}@${manifest.version}: ${exportEntries.length} public entrypoints.`);
