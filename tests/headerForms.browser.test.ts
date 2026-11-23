// A module header's cycle and icon toggle, in a compact bar on a desktop and a handset window: a press moves the cycle
// to its next option, wrapping after the last, and its word, which is all it shows, wears the bar's action type in the
// theme's text colour; a press flips the toggle, whose glyph is what the next press does; both sit inside the bar.
// Read in Chromium from headerGlyphScene.tsx; each window's capture lands in .local/captures.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,HANDSET_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {SUITE_ROOT} from './bundled.ts';
import {createTheme} from '../src/theme.ts';
import {CYCLE_OPTIONS,HeaderForm} from './headerGlyphCases.ts';

const CAPTURES=join(SUITE_ROOT,'.local','captures','headerForms');
mkdirSync(CAPTURES,{recursive:true});
// The play glyph is drawn as a path, the pause glyph as two bars; the glyphs carry no identifier, so their shapes tell
// them apart.
const PAUSED_GLYPH='svg path',RUNNING_GLYPH='svg rect';
// A surface's action label size no default shares, so the cycle's word can only match it by wearing that label's type.
// The cell's chrome goes unasserted: the application root's button reset already strips it from every Cycle here.
const SURFACE_ACTION_SIZE='17px';
const TYPE=['fontFamily','fontSize','fontWeight','letterSpacing','textTransform'] as const;
const TEXT_COLOR=createTheme().colors.text;

for(const viewport of [DESKTOP_VIEWPORT,HANDSET_VIEWPORT])test(`the header forms at ${viewport.width}px`,async()=>{
 const page=await openScene('tests/headerGlyphScene.tsx',viewport,SCENE_GL.software);
 const named=(name: string)=>page.getByRole('button',{name:new RegExp(`^${name}`)});
 const cycle=named(HeaderForm.CYCLE),toggle=named(HeaderForm.TOGGLE),bar=page.locator('.action-bar').first();
 await bar.screenshot({path:join(CAPTURES,`${viewport.width}-before.png`)});
 assert.equal(await cycle.textContent(),CYCLE_OPTIONS[0],'the cycle shows only its current option');
 // One read: the word beside a probe wearing the bar's action label and a probe in the theme's text colour.
 const {type:[word,action],color:[wordColor,textColor]}=await bar.evaluate((node,[size,keys,text])=>{
  const word=node.querySelector('.bd-cycle .bd-label');if(!word)throw new Error('the cycle draws no label');
  node.style.setProperty('--label-action-size',size);
  const action=document.createElement('span'),colored=document.createElement('span');
  action.className='bd-label bd-label--action';colored.style.color=text;node.append(action,colored);
  const style=(element: Element)=>getComputedStyle(element),type=(element: Element)=>keys.map(key=>style(element)[key]);
  const read={type:[type(word),type(action)],color:[style(word).color,style(colored).color]};
  action.remove();colored.remove();node.style.removeProperty('--label-action-size');return read;
 },[SURFACE_ACTION_SIZE,TYPE,TEXT_COLOR] as const);
 assert.deepEqual(word,action,`the cycle's word wears ${word}, its bar's action label ${action}`);
 assert.equal(wordColor,textColor,`the cycle's word is ${wordColor}, the theme's text ${textColor}`);
 // A full round and one press more: the cycle wraps to its first option, and the capture after shows it moved.
 for(const index of [...CYCLE_OPTIONS.keys(),0]){
  await cycle.click();
  await page.waitForFunction(([name,text])=>document.querySelector(`[aria-label^="${name}"]`)?.textContent===text,
   [HeaderForm.CYCLE,CYCLE_OPTIONS[(index+1)%CYCLE_OPTIONS.length]]);
 }
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 assert.equal(await toggle.locator(PAUSED_GLYPH).count(),1,'a toggle that is off shows the glyph that turns it on');
 await toggle.click();
 await page.waitForFunction(name=>document.querySelector(`[aria-label="${name}"]`)?.getAttribute('aria-pressed')
  ==='true',HeaderForm.TOGGLE);
 assert.equal(await toggle.locator(RUNNING_GLYPH).count(),2,'a toggle that is on shows the glyph that turns it off');
 const barBox=await bar.boundingBox()??assert.fail('the compact bar has no box');
 for(const control of [cycle,toggle]){
  const box=await control.boundingBox()??assert.fail('a header control has no box');
  assert.ok(box.x>=barBox.x&&box.y>=barBox.y&&box.y+box.height<=barBox.y+barBox.height
   &&box.x+box.width<=barBox.x+barBox.width,
   `a header control at ${JSON.stringify(box)} leaves its bar at ${JSON.stringify(barBox)}`);
 }
 await bar.screenshot({path:join(CAPTURES,`${viewport.width}-after.png`)});
});
