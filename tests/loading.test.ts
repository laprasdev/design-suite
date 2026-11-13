import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {after,before,describe,it} from 'node:test';
import {Children,isValidElement,type ComponentProps} from 'react';
import {build} from 'esbuild';
import type {Label} from '../src/react/accents.tsx';

const root=fileURLToPath(new URL('../',import.meta.url));

describe('loading composition ownership',()=>{
 let directory='';
 let module:typeof import('../src/react/Pokeball.tsx') & Pick<typeof import('../src/react/accents.tsx'),'Label'>;
 before(async()=>{
  mkdirSync(join(root,'.local'),{recursive:true});
  directory=mkdtempSync(join(root,'.local/loading-contract-'));
  const output=await build({absWorkingDir:root,stdin:{resolveDir:root,contents:
   "export * from './src/react/Pokeball.tsx';export {Label} from './src/react/accents.tsx';"},
   bundle:true,write:false,format:'esm',platform:'node',external:['react','react/*']});
  const file=join(directory,'loading.mjs');
  writeFileSync(file,output.outputFiles[0].text);
  module=await import(pathToFileURL(file).href);
 });
 after(()=>{if(directory)rmSync(directory,{recursive:true,force:true});});

 it('composes the existing status Label for default and custom copy',()=>{
  for(const children of [undefined,'Loading players']){
   const indicator=module.LoadingIndicator({children});
   const [ball,label]=Children.toArray(indicator.props.children);
   assert(isValidElement(ball));
   assert.equal(ball.type,module.PokeballSpinner);
   assert(isValidElement<ComponentProps<typeof Label>>(label));
   assert.equal(label.type,module.Label,'LoadingIndicator must compose Label, not recreate it.');
   assert.equal(label.props.kind,'action');
   assert.equal(label.props.children,children??'LOADING');
   const typography=Object.keys(label.props.style??{}).filter(name=>
    /^(?:font|letterSpacing|lineHeight|textTransform)/.test(name));
   assert.deepEqual(typography,[],'Typography belongs to Label, not loader inline styles.');
  }
 });

 it('leaves typography to Label while loader CSS owns layout and animation',()=>{
  const css=readFileSync(join(root,'src/react/loading.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  // The ball's line-height:0 is icon geometry, not label typography.
  const typography=[...css.matchAll(/[;{]\s*(font(?:-[\w-]+)?|letter-spacing|text-transform)\s*:/gi)];
  assert.deepEqual(typography.map(match=>match[1]),[],
   'Typography belongs to Label; loading.css must not restate font or text styling.');
 });
});
