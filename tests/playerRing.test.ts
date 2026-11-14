// The player ring's contract: a RING holds one ARC for each arc it shows; arcs end flush, so adjoining segments never
// overlap their colours; an end that no arc continues gets a CAP in its ARC; and the ARC carries the arc's opacity
// once. The stylesheet styles the ring through the same contract.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {after,describe,it} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {ElementContract} from '../src/react/elementContract.ts';
import type {PhotoRing} from '../src/react/PlayerIcon.tsx';
import {PlayerIconElement} from '../src/react/playerIconElements.ts';
import {SUITE_ROOT,bundled} from './bundled.ts';

const {module,dispose}=await bundled<typeof import('../src/react/PlayerIcon.tsx')>(['src/react/PlayerIcon.tsx']);
after(dispose);
const {RING,ARC,STROKE,CAP}=PlayerIconElement;
const pattern=(selector: string)=>selector.replace(/[.[\]]/g,'\\$&');
const drawn=(ring: PhotoRing)=>renderToStaticMarkup(createElement(module.PlayerIcon,{photo:null,ring}));
const count=(markup: string,part: ElementContract)=>
 [...markup.matchAll(new RegExp(`class="${pattern(part.className)}"`,'g'))].length;

describe('player ring',()=>{
 it('draws one ARC for each arc it shows',()=>{
  assert.equal(count(drawn({pct:.4}),ARC),1);
  assert.equal(count(drawn({segments:[{pct:.2},{start:.5,pct:.2},{start:.8,pct:0}]}),ARC),2);
 });

 it('rounds both ends of a progress arc and neither of a full turn',()=>{
  assert.equal(count(drawn({pct:.4}),CAP),2);
  assert.equal(count(drawn({pct:1}),CAP),0);
 });

 it('keeps a join between segments flush and rounds only the ends no segment continues',()=>{
  // 0.1 + 0.2 is 0.30000000000000004: still the start of the next segment.
  assert.equal(count(drawn({segments:[{start:.1,pct:.2},{start:.3,pct:.25}]}),CAP),2);
  assert.equal(count(drawn({segments:[{pct:.2},{start:.5,pct:.2}]}),CAP),4);
  // A segment that passes the top joins the one starting there.
  assert.equal(count(drawn({segments:[{start:.75,pct:.5},{start:.25,pct:.5}]}),CAP),0);
 });

 it('applies an arc\'s opacity once, to its stroke and caps together',()=>{
  const markup=drawn({segments:[{pct:.3,opacity:.4}]});
  assert.match(markup,new RegExp(`<g class="${pattern(ARC.className)}"[^>]*opacity="0.4"`));
  assert.doesNotMatch(markup,/(?:stroke|fill)-opacity/);
 });

 it('is styled through the same contract',()=>{
  const css=readFileSync(join(SUITE_ROOT,'src/react/portraits-modal.css'),'utf8');
  for(const part of [RING,ARC,STROKE,CAP])
   assert.match(css,new RegExp(`^${pattern(part.selector)}[ \\[{]`,'m'),`portraits-modal.css styles ${part.selector}`);
 });
});
