// Suite source run under Node: esbuild bundles the named files into one module, written to a fresh scratch directory
// and imported from there. Packages stay external and stylesheets load empty, since no test reads either through the
// bundle. `dispose` removes the directory.
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {basename,extname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build,type Plugin} from 'esbuild';

export const SUITE_ROOT=fileURLToPath(new URL('../',import.meta.url));
const SCRATCH=join(SUITE_ROOT,'.local');
const REACT=fileURLToPath(import.meta.resolve('react'));
const REPLACED='replaced-hooks';

// React with some of its hooks replaced, so a component renders when it is called: `hooks` is module source exporting
// the replacements beside the rest of React, its default export included. A portal renders nothing.
export const replacedHooks=(hooks: string): Plugin=>({name:REPLACED,setup(builder) {
 builder.onResolve({filter:/^react$/},()=>({path:'react',namespace:REPLACED}));
 builder.onResolve({filter:/^react-dom/},()=>({path:'react-dom',namespace:REPLACED}));
 builder.onLoad({filter:/.*/,namespace:REPLACED},args=>({resolveDir:SUITE_ROOT,contents:args.path==='react'
  ?`export * from ${JSON.stringify(REACT)};\nexport {default} from ${JSON.stringify(REACT)};\n${hooks}`
  :'export const createPortal = () => null;'}));
}});

export interface Bundled<Module> {
 readonly module: Module;
 dispose(): void;
}

/** A fresh directory under .local (which git leaves out, and where the suite's packages resolve), named from `name`,
 *  and its removal. */
export function scratchDirectory(name: string): {readonly directory: string; dispose(): void} {
 mkdirSync(SCRATCH,{recursive:true});
 const directory=mkdtempSync(join(SCRATCH,`${name}-`));
 return {directory,dispose:()=>rmSync(directory,{recursive:true,force:true})};
}

// `sources` are paths from the suite root, and the module exports what each of them exports. `plugins` reach esbuild
// as they are, for a test that replaces a dependency.
export async function bundled<Module>(sources: readonly [string,...string[]],plugins: readonly Plugin[]=[]):
 Promise<Bundled<Module>> {
 const [first]=sources,{directory,dispose}=scratchDirectory(basename(first,extname(first)));
 try {
  const output=await build({absWorkingDir:SUITE_ROOT,bundle:true,write:false,format:'esm',platform:'node',
   packages:'external',loader:{'.css':'empty'},plugins:[...plugins],stdin:{resolveDir:SUITE_ROOT,
    contents:sources.map(source=>`export * from './${source}';`).join('\n')}});
  const file=join(directory,'bundle.mjs');
  writeFileSync(file,output.outputFiles[0].text);
  const module: Module=await import(pathToFileURL(file).href);
  return {module,dispose};
 } catch(error) {
  dispose();
  throw error;
 }
}
