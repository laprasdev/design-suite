// A compact header glyph, on a bar, alone or in a choice, is drawn at its action label's size; a tone draws one colour
// on everything that wears it. Read in Chromium from headerGlyphScene.tsx.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,openScene} from './browserScene.ts';
import {CompactGlyph,TONES,toneButton,toneIcon} from './headerGlyphCases.ts';

const page=await openScene('tests/headerGlyphScene.tsx',DESKTOP_VIEWPORT);
const named=(name: string)=>page.locator(`[aria-label="${name}"]`).first();
const glyphOf=(name: string)=>named(name).locator('svg').first();
for(const form of Object.values(CompactGlyph))test(`a ${form}'s glyph is its action label's size`,async()=>{
 const [glyph,label]=await named(form).evaluate(node=>{
  const probe=document.createElement('span');probe.className='bd-label bd-label--action';node.append(probe);
  const size=parseFloat(getComputedStyle(probe).fontSize);probe.remove();return size;
 }).then(async label=>[await glyphOf(form).evaluate(svg=>svg.getBoundingClientRect().width),label]);
 assert.equal(glyph,label,`${form} draws its glyph at ${glyph}px, its label at ${label}px`);
});
for(const tone of TONES)test(`the ${tone} tone is one colour on a button and on the notice's glyph`,async()=>{
 const colour=(name: string)=>glyphOf(name).evaluate(svg=>getComputedStyle(svg).color);
 const [button,icon,plain]=await Promise.all([
  colour(toneButton(tone)),colour(toneIcon(tone)),colour(CompactGlyph.BAR),
 ]);
 assert.equal(button,icon,`${tone}: the button is ${button}, the notice's glyph ${icon}`);
 assert.notEqual(button,plain,`${tone}: the button draws no tone`);
});
