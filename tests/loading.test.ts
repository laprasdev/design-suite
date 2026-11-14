import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {after,describe,it} from 'node:test';
import {Children,isValidElement,type ComponentProps} from 'react';
import type {Label} from '../src/react/accents.tsx';
import {SUITE_ROOT,bundled} from './bundled.ts';

type LoadingModule=typeof import('../src/react/Pokeball.tsx') & Pick<typeof import('../src/react/accents.tsx'),'Label'>;
const {module,dispose}=await bundled<LoadingModule>(['src/react/Pokeball.tsx','src/react/accents.tsx']);
after(dispose);

describe('loading composition ownership',()=>{
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
  const css=readFileSync(join(SUITE_ROOT,'src/react/loading.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  // The ball's line-height:0 is icon geometry, not label typography.
  const typography=[...css.matchAll(/[;{]\s*(font(?:-[\w-]+)?|letter-spacing|text-transform)\s*:/gi)];
  assert.deepEqual(typography.map(match=>match[1]),[],
   'Typography belongs to Label; loading.css must not restate font or text styling.');
 });
});
