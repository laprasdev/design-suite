// A module header's title choice and icon toggle, on a desktop and a handset window: the title's word, in the title's
// own case and tracking, and the chosen option's name in its regular-weight typography role are one trigger, a press
// opening the list and an arrow on the closed title, or a caret beside it, stepping the choice; choosing moves the
// name, and an unavailable option draws faded, keeps the choice and says why in the bar's notice. A press flips the
// toggle, whose glyph is what the next press does, and the toggle sits inside its bar, whose text colour its own rule
// gives it. Read in Chromium from headerGlyphScene.tsx; each window's capture lands in .local/captures.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,HANDSET_VIEWPORT,named,openScene,SCENE_GL} from './browserScene.ts';
import {SUITE_ROOT} from './bundled.ts';
import {SCENE_ROOT_ID} from './sceneRoot.ts';
import {Opacity,Typography} from '../src/tokens.ts';
import {createTheme} from '../src/theme.ts';
import {ListboxElement} from '../src/react/listboxSelectElements.ts';
import {ActionBarElement,ActionNoticeElement} from '../src/react/actionBarElements.ts';
import {MODULE_HEADER_ATTRIBUTE,ModuleTitleChoiceElement,ModuleTitleChosenElement}
 from '../src/react/module/gridModuleElements.ts';
import {HeaderForm,TITLE_OPTIONS,TOGGLE_GLYPH_ATTRIBUTE,ToggleGlyph} from './headerGlyphCases.ts';

const CAPTURES=join(SUITE_ROOT,'.local','captures','headerForms');
mkdirSync(CAPTURES,{recursive:true});
// What the title's word must take from its heading, and the chosen name from its typography role.
const TITLE_TYPE=['fontFamily','fontSize','fontWeight','letterSpacing','textTransform'] as const;
const CHOSEN=Typography.chosen;
// A root colour no theme uses: a bar that only inherited its text colour would show this instead of its own.
const FOREIGN_ROOT_COLOR='rgb(1, 2, 3)';
const TEXT_COLOR=createTheme().colors.text;
const [FIRST,SECOND,UNAVAILABLE]=TITLE_OPTIONS;

for(const viewport of [DESKTOP_VIEWPORT,HANDSET_VIEWPORT])test(`the header forms at ${viewport.width}px`,async()=>{
 const page=await openScene('tests/headerGlyphScene.tsx',viewport,SCENE_GL.software);
 const title=page.locator(ModuleTitleChoiceElement.selector),toggle=named(page,HeaderForm.TOGGLE);
 const bar=page.locator(ActionBarElement.selector).first();
 const option=(label: string)=>page.locator(`${ListboxElement.OPTION.selector}[aria-label="${label}"]`);
 const notice=page.locator(ActionNoticeElement.ROOT.selector);
 await page.locator(`[${MODULE_HEADER_ATTRIBUTE}]`).first()
  .screenshot({path:join(CAPTURES,`${viewport.width}-closed.png`)});
 assert.equal(await title.textContent(),`${HeaderForm.TITLE}${FIRST.label}`,'the title shows its word and its choice');
 const [back,next]=[0,1].map(index=>page.locator(ListboxElement.STEP.selector).nth(index));
 assert.equal(await page.locator(ListboxElement.STEP.selector).count(),2,'the title draws its two step carets');
 assert.ok(await back.isDisabled(),'the first option has no previous one');
 const shows=(option: typeof TITLE_OPTIONS[number])=>page.waitForFunction(([choice,text])=>
  document.querySelector(choice)?.textContent===text,
  [ModuleTitleChoiceElement.selector,`${HeaderForm.TITLE}${option.label}`] as const);
 await next.click();
 await shows(SECOND);
 assert.equal(await title.getAttribute('aria-expanded'),'false','a caret steps without opening the list');
 await page.screenshot({path:join(CAPTURES,`${viewport.width}-stepped.png`)});
 await back.click();
 await shows(FIRST);
 const read=await page.evaluate(([choice,chosen,keys,root,text])=>{
  const trigger=document.querySelector(choice),name=document.querySelector(chosen),heading=trigger?.closest('h2');
  const scene=document.getElementById(root);
  if(!trigger||!name||!heading||!scene)throw new Error('the scene draws no title choice, chosen name or root');
  scene.style.color=text;
  const style=(element: Element)=>getComputedStyle(element),type=(element: Element)=>keys.map(key=>style(element)[key]);
  return {heading:type(heading),word:type(trigger),name:{size:style(name).fontSize,weight:style(name).fontWeight,
   case:style(name).textTransform}};
 },[ModuleTitleChoiceElement.selector,ModuleTitleChosenElement.selector,TITLE_TYPE,SCENE_ROOT_ID,FOREIGN_ROOT_COLOR] as
  const);
 assert.deepEqual(read.word,read.heading,`the title's word wears ${read.word}, every title ${read.heading}`);
 assert.deepEqual(read.name,{size:`${CHOSEN.fontSize}px`,weight:String(CHOSEN.fontWeight),case:'none'},
  'the chosen name wears the chosen typography role, in the case it is written in');
 const barColor=await bar.evaluate(node=>getComputedStyle(node).color);
 const probe=await page.evaluate(text=>{const span=document.createElement('span');span.style.color=text;
  document.body.append(span);const color=getComputedStyle(span).color;span.remove();return color;},TEXT_COLOR);
 assert.equal(barColor,probe,`the bar's text is ${barColor} under a foreign root, its theme's ${probe}`);
 await title.click();
 await page.locator(ListboxElement.POPOVER.selector).waitFor();
 await page.screenshot({path:join(CAPTURES,`${viewport.width}-open.png`)});
 assert.equal(await option(UNAVAILABLE.label).getAttribute('aria-disabled'),'true');
 assert.equal(Number(await option(UNAVAILABLE.label).evaluate(node=>getComputedStyle(node).opacity)),Opacity.low,
  'an unavailable option fades by the low opacity token');
 await option(SECOND.label).click();
 await page.waitForFunction(([choice,text])=>document.querySelector(choice)?.textContent===text,
  [ModuleTitleChoiceElement.selector,`${HeaderForm.TITLE}${SECOND.label}`] as const);
 await title.click();
 // A pointer still presses an unavailable row, which Playwright refuses to do unforced.
 await option(UNAVAILABLE.label).click({force:true});
 await notice.waitFor();
 assert.equal(await title.textContent(),`${HeaderForm.TITLE}${SECOND.label}`,'an unavailable option keeps the choice');
 assert.equal(await notice.getAttribute('title'),UNAVAILABLE.unavailable,'the bar\'s notice says why it was refused');
 await title.focus();
 await page.keyboard.press('ArrowUp');
 await shows(FIRST);
 assert.equal(await title.getAttribute('aria-expanded'),'false','an arrow on the closed title steps without opening');
 await page.keyboard.press('ArrowDown');
 await shows(SECOND);
 await page.keyboard.press('ArrowDown');
 assert.equal(await title.getAttribute('aria-expanded'),'false');
 assert.equal(await title.textContent(),`${HeaderForm.TITLE}${SECOND.label}`,
  'stepping onto an unavailable option refuses');
 const glyph=async()=>toggle.locator(`[${TOGGLE_GLYPH_ATTRIBUTE}]`).getAttribute(TOGGLE_GLYPH_ATTRIBUTE);
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 assert.equal(await glyph(),ToggleGlyph.OFF,'a toggle that is off shows the glyph that turns it on');
 await toggle.click();
 await page.waitForFunction(name=>document.querySelector(`[aria-label="${name}"]`)?.getAttribute('aria-pressed')
  ==='true',HeaderForm.TOGGLE);
 assert.equal(await glyph(),ToggleGlyph.ON,'a toggle that is on shows the glyph that turns it off');
 const barBox=await bar.boundingBox()??assert.fail('the compact bar has no box');
 const box=await toggle.boundingBox()??assert.fail('the toggle has no box');
 assert.ok(box.x>=barBox.x&&box.y>=barBox.y&&box.y+box.height<=barBox.y+barBox.height
  &&box.x+box.width<=barBox.x+barBox.width,
  `the toggle at ${JSON.stringify(box)} leaves its bar at ${JSON.stringify(barBox)}`);
});
