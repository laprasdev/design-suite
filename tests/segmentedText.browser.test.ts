// Every SegmentedControl density draws its labels at the text floor or larger: compact takes the theme's caption
// size, never the synth's smaller caption token. Read in Chromium from segmentedTextScene.tsx.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,openScene} from './browserScene.ts';
import {SEGMENT_DENSITIES,SEGMENT_OPTIONS,TEXT_FLOOR} from './segmentedTextCases.ts';

const page=await openScene('tests/segmentedTextScene.tsx',DESKTOP_VIEWPORT);
for(const density of SEGMENT_DENSITIES)test(`a ${density} control's labels are at least the text floor`,async()=>{
 const control=page.getByRole('group',{name:density,exact:true});
 for(const {label} of SEGMENT_OPTIONS){
  const size=await control.getByText(label,{exact:true})
   .evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
  assert.ok(size>=TEXT_FLOOR,`${density} draws "${label}" at ${size}px, under ${TEXT_FLOOR}px`);
 }
});
