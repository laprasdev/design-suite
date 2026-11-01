import {readFile,rm,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {relative,resolve} from 'node:path';
import {build} from 'esbuild';

// The manifest owns the public entrypoints. Build only inside this package.
const root=fileURLToPath(new URL('..',import.meta.url));
const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const entries=Object.values(manifest.exports);
const entryPoints=Object.fromEntries(entries.filter(entry=>/\.tsx?$/.test(entry.source)).map(entry=>[
  relative('dist',entry.default).replace(/\.js$/,''),resolve(root,entry.source),
]));
const outdir=resolve(root,'dist');
await rm(outdir,{recursive:true,force:true});
await mkdir(outdir,{recursive:true});
await build({absWorkingDir:root,entryPoints,outdir,bundle:true,splitting:true,format:'esm',
  platform:'neutral',target:'es2022',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','lucide-react'],
  logLevel:'warning'});
await build({absWorkingDir:root,entryPoints:[resolve(root,'src/react/styles.css')],
  outfile:resolve(outdir,'react/styles.css'),bundle:true,logLevel:'warning'});
console.log(`Built ${manifest.name}@${manifest.version}: ${entries.length} public entrypoints.`);
