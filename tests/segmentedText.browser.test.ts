// Every SegmentedControl density draws its labels at the text floor or larger. Read in Chromium from
// segmentedTextScene.tsx. The floor is the owner's 10 px, `TEXT_FLOOR`; the module text size (12) stood in for it
// until the floor had its own constant. Compact draws the caption token, `Typography.caption.fontSize` (10), which
// meets that floor, so the bound is the floor itself and not the theme's larger caption size.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {SEGMENT_DENSITIES,SEGMENT_OPTIONS} from './segmentedTextCases.ts';
import {TEXT_FLOOR} from '../src/moduleGridLayout.ts';

const page=await openScene('tests/segmentedTextScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
for(const {name:density} of SEGMENT_DENSITIES)
 test(`a ${density} control's labels are at least the text floor`,async()=>{
  const control=page.getByRole('group',{name:density,exact:true});
  for(const {label} of SEGMENT_OPTIONS){
   const size=await control.getByText(label,{exact:true})
    .evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
   assert.ok(size>=TEXT_FLOOR,`${density} draws "${label}" at ${size}px, under ${TEXT_FLOOR}px`);
  }
 });
