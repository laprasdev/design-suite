// The manifest owns the public entrypoints. Build only inside this package.
import { mkdir, readFile, rm } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { isNonEmptyString, isRecord } from '../src/valueChecks.ts';

interface ExportTarget {
  readonly source: string;
  readonly default: string;
}

function readExportTarget(subpath: string, value: unknown): ExportTarget | null {
  if (typeof value === 'string') return null;
  if (!isRecord(value) || !isNonEmptyString(value.source) || !isNonEmptyString(value.default)) {
    throw new Error(`package.json exports["${subpath}"] must state non-empty source and default paths.`);
  }
  return { source: value.source, default: value.default };
}

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest: unknown = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (!isRecord(manifest) || !isNonEmptyString(manifest.name) || !isNonEmptyString(manifest.version)
  || !isRecord(manifest.exports)) {
  throw new Error('package.json must state name, version and exports.');
}
const exportEntries = Object.entries(manifest.exports);
const targets = exportEntries.flatMap(([subpath, value]) => {
  const target = readExportTarget(subpath, value);
  return target ? [target] : [];
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
    logLevel: 'warning',
  });
}
console.log(`Built ${manifest.name}@${manifest.version}: ${exportEntries.length} public entrypoints.`);
