// An anchored Modal is drawn above the content layer, in Chromium (anchoredLayerScene.tsx): rendered inside a box that
// clips what it holds, from an element or from a point, its panel is outside that box and hit at its far edge; one
// opened at a point starts there, the popover's gap below it, and stays there when it grows after placement.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {POPOVER_GAP} from '../src/react/useAnchoredPopover.ts';
import {DESKTOP_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {SCENE_ROOT_ID} from './sceneRoot.ts';
import {AnchoredCase,CASE_ATTRIBUTE,GROWN_ATTRIBUTE,OPENED_AT,PANEL_CASE_ATTRIBUTE} from './anchoredLayerCases.ts';

const page=await openScene('tests/anchoredLayerScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
const panel=(name: string)=>page.locator(`[${PANEL_CASE_ATTRIBUTE}="${name}"]`);
await panel(AnchoredCase.POINT).locator(`[${GROWN_ATTRIBUTE}]`).waitFor();
// The growth's resize is observed and its placement drawn within the next two frames.
await page.evaluate(()=>new Promise(drawn=>requestAnimationFrame(()=>requestAnimationFrame(drawn))));
const SOURCE={[AnchoredCase.ELEMENT]:'an element',[AnchoredCase.POINT]:'a point'};

for(const name of Object.values(AnchoredCase))
 test(`an anchored Modal from ${SOURCE[name]} is not clipped by the box it renders in`,async()=>{
  const seen=await panel(name).evaluate((node,{box,rootId})=>{
   const clip=document.querySelector(box)??(()=>{throw new Error(`The scene lacks ${box}.`);})();
   const root=document.getElementById(rootId)??(()=>{throw new Error(`The scene lacks #${rootId}.`);})();
   const drawn=node.getBoundingClientRect(),bounds=clip.getBoundingClientRect();
   const x=drawn.left+drawn.width/2,y=drawn.bottom-4,hit=document.elementFromPoint(x,y);
   const outside=x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom;
   return {inBox:clip.contains(node),inRoot:root.contains(node),hit:node.contains(hit),outside,
    at:{left:drawn.left,top:drawn.top}};
  },{box:`[${CASE_ATTRIBUTE}="${name}"]`,rootId:SCENE_ROOT_ID});
  assert.equal(seen.outside,true,'the point hit lies outside the box, where the box would clip it');
  assert.equal(seen.inBox,false,'the panel is drawn outside the box');
  assert.equal(seen.inRoot,true,'the panel is drawn into the application root the Modal renders in');
  assert.equal(seen.hit,true,'the panel\'s far edge is hit, not clipped away');
  if(name===AnchoredCase.POINT)assert.deepEqual(seen.at,{left:OPENED_AT.x,top:OPENED_AT.y+POPOVER_GAP});
 });
