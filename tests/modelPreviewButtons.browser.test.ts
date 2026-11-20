// The model preview pads only the Buttons it means to: Play, its bar's bordered Button, takes the surface's inline
// padding token, and its text actions, Reset Camera and its notice's recovery Button, are reached by no token and
// keep their labels' own padding, none. Read in Chromium from modelPreviewButtonsScene.tsx at a desktop and a phone
// width, once its notice shows that the model's file failed to load.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,PHONE_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {PADDING_TOKEN,PREVIEW_ASSET,PREVIEW_BUTTONS} from './modelPreviewButtonsCases.ts';

const page=await openScene('tests/modelPreviewButtonsScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
const button=(label: string)=>page.getByRole('button',{name:label});
await Promise.all(PREVIEW_BUTTONS.map(({label})=>button(label).waitFor()));

test('the notice is the model file\'s failure to load',async()=>{
 const detail=await page.getByRole('alert').getAttribute('title');
 assert.ok(detail?.includes(PREVIEW_ASSET.path),`the notice names ${PREVIEW_ASSET.path}; it reads ${detail}`);
});

for(const viewport of [DESKTOP_VIEWPORT,PHONE_VIEWPORT])test(`at ${viewport.width}px`,async t=>{
 await page.setViewportSize(viewport);
 await t.test('the preview\'s Buttons take its inline padding token only where it pads them',async()=>{
  for(const {label,padded} of PREVIEW_BUTTONS) {
   const {token,start,end}=await button(label).evaluate((node,name)=>{
    const style=getComputedStyle(node);
    return {token:style.getPropertyValue(name).trim(),start:style.paddingInlineStart,end:style.paddingInlineEnd};
   },PADDING_TOKEN);
   assert.equal(token!=='',padded,`${label}: ${PADDING_TOKEN} is ${token||'unset'}`);
   assert.deepEqual([start,end],padded?[token,token]:['0px','0px'],label);
   assert.equal(parseFloat(start)>0,padded,`${label}: its inline padding is ${start}`);
  }
 });
});
