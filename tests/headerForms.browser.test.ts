// A module header's title choice and icon toggle, on a desktop and a handset window: the title's word, then the
// previous caret, the chosen option's fixed-width Crossfade carousel slot and the next caret; pressing the word or the
// name opens the list, arrows on the closed title or the carets step the choice without moving the carets, and an
// unavailable option draws faded, keeps the choice and says why in the bar's notice.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,HANDSET_VIEWPORT,named,openScene,SCENE_GL} from './browserScene.ts';
import {SUITE_ROOT} from './bundled.ts';
import {SCENE_ROOT_ID} from './sceneRoot.ts';
import {Opacity,Typography} from '../src/tokens.ts';
import {createTheme} from '../src/theme.ts';
import {D} from '../src/synth/design/index.ts';
import {ApplicationElement} from '../src/react/applicationElements.ts';
import {CAROUSEL_INACTIVE,CrossfadePageElement,PAGE_STACK_DIRECTION,PAGE_STACK_MOVING}
 from '../src/react/crossfadeElements.ts';
import {ListboxElement} from '../src/react/listboxSelectElements.ts';
import {ActionBarElement,ActionNoticeElement} from '../src/react/actionBarElements.ts';
import {
 MODULE_HEADER_ATTRIBUTE,MODULE_HEADER_FORM_ATTRIBUTE,ModuleHeaderForm,ModuleTitleChoiceElement,
} from '../src/react/module/gridModuleElements.ts';
import {CompactGlyph,HeaderForm,TITLE_OPTIONS,TOGGLE_GLYPH_ATTRIBUTE,ToggleGlyph} from './headerGlyphCases.ts';

const CAPTURES=join(SUITE_ROOT,'.local','captures','headerForms');
mkdirSync(CAPTURES,{recursive:true});
const TITLE_TYPE=['fontFamily','fontSize','fontWeight','letterSpacing','textTransform'] as const;
const CHOSEN=Typography.chosen;
const FOREIGN_ROOT_COLOR='rgb(1, 2, 3)',FOREIGN_CARD='rgb(255, 255, 255)';
const TEXT_COLOR=createTheme().colors.text;
const [FIRST,SECOND,UNAVAILABLE]=TITLE_OPTIONS;
const ACTIVE_CHOSEN=`${ListboxElement.CHOSEN.selector} .${CrossfadePageElement.PAGE}:not([${CAROUSEL_INACTIVE}])`;

for(const viewport of [DESKTOP_VIEWPORT,HANDSET_VIEWPORT])test(`the header forms at ${viewport.width}px`,async()=>{
 const page=await openScene('tests/headerGlyphScene.tsx',viewport,SCENE_GL.software);
 const header=page.locator(`[${MODULE_HEADER_ATTRIBUTE}]`).first();
 const title=page.locator(ModuleTitleChoiceElement.selector),toggle=named(page,HeaderForm.TOGGLE);
 const chosen=page.locator(ListboxElement.CHOSEN.selector);
 const stack=chosen.locator(`.${CrossfadePageElement.SURFACE}`);
 const bar=page.locator(ActionBarElement.selector).first();
 const option=(label: string)=>page.locator(`${ListboxElement.OPTION.selector}[aria-label="${label}"]`);
 const notice=page.locator(ActionNoticeElement.ROOT.selector);
 const shownName=()=>page.locator(ACTIVE_CHOSEN).first().textContent();
 await header.screenshot({path:join(CAPTURES,`${viewport.width}-closed.png`)});
 assert.equal(await header.getAttribute(MODULE_HEADER_FORM_ATTRIBUTE),ModuleHeaderForm.CHOICE);
 assert.equal(await header.evaluate(node=>getComputedStyle(node).flexWrap),'wrap');
 assert.equal(await title.textContent(),HeaderForm.TITLE,'the title button shows the module word');
 assert.equal(await shownName(),FIRST.label,'the carousel slot shows the active option');
 const [back,next]=[0,1].map(index=>page.locator(ListboxElement.STEP.selector).nth(index));
 assert.equal(await page.locator(ListboxElement.STEP.selector).count(),2,'the title draws its two step carets');
 assert.ok(!await back.isDisabled(),'the carets go round a ring: the first option\'s previous one is the last');
 const [titleBox,nameBox,backBox,nextBox]=await Promise.all([
  title.boundingBox(),chosen.boundingBox(),back.boundingBox(),next.boundingBox(),
 ]);
 if(!titleBox||!nameBox||!backBox||!nextBox)throw new Error('the title choice or step carets lack a box');
 const tabButton={w:D.moduleGrid.tabMinWidth,h:D.moduleGrid.tabMinHeight};
 assert.deepEqual({w:backBox.width,h:backBox.height},tabButton);
 assert.deepEqual({w:nextBox.width,h:nextBox.height},tabButton);
 assert.ok(titleBox.x+titleBox.width<=backBox.x,'the previous caret sits after the module word');
 assert.ok(backBox.x+backBox.width<=nameBox.x&&nameBox.x+nameBox.width<=nextBox.x,
  'the carets sit on either side of the chosen name slot');
 const shows=(item: typeof TITLE_OPTIONS[number])=>page.waitForFunction(([sel,moving,text])=>{
  const active=document.querySelector(sel),surface=active?.parentElement;
  return active?.textContent===text&&!surface?.hasAttribute(moving);
 },[ACTIVE_CHOSEN,PAGE_STACK_MOVING,item.label] as const);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await next.click();
 assert.equal(await stack.getAttribute(PAGE_STACK_DIRECTION),'1','stepping next carousels forward');
 await shows(SECOND);
 assert.equal(await title.getAttribute('aria-expanded'),'false','a caret steps without opening the list');
 const [nameAfter,backAfter,nextAfter]=await Promise.all([
  chosen.boundingBox(),back.boundingBox(),next.boundingBox(),
 ]);
 assert.deepEqual({back:backAfter,next:nextAfter,w:nameAfter?.width},{back:backBox,next:nextBox,w:nameBox.width},
  'the carets and fixed-width slot never move as the name changes');
 await page.screenshot({path:join(CAPTURES,`${viewport.width}-stepped.png`)});
 await back.click();
 assert.equal(await stack.getAttribute(PAGE_STACK_DIRECTION),'-1','stepping back carousels in reverse');
 await shows(FIRST);
 await page.emulateMedia({reducedMotion:'reduce'});
 const read=await page.evaluate(([choice,chosenSel,keys,root,text])=>{
  const trigger=document.querySelector(choice),name=document.querySelector(`${chosenSel} .bd-label`);
  const heading=trigger?.closest('h2'),scene=document.getElementById(root);
  if(!trigger||!name||!heading||!scene)throw new Error('the scene draws no title choice, chosen name or root');
  scene.style.color=text;
  const style=(element: Element)=>getComputedStyle(element),type=(element: Element)=>keys.map(key=>style(element)[key]);
  return {heading:type(heading),word:type(trigger),
   headingClip:{ws:style(heading).whiteSpace,ox:style(heading).overflowX},
   name:{size:style(name).fontSize,weight:style(name).fontWeight,case:style(name).textTransform}};
 },[ModuleTitleChoiceElement.selector,ACTIVE_CHOSEN,TITLE_TYPE,SCENE_ROOT_ID,FOREIGN_ROOT_COLOR] as const);
 assert.deepEqual(read.word,read.heading,`the title's word wears ${read.word}, every title ${read.heading}`);
 assert.deepEqual(read.headingClip,{ws:'normal',ox:'visible'},'the choice heading wraps instead of clipping');
 assert.deepEqual(read.name,{size:`${CHOSEN.fontSize}px`,weight:String(CHOSEN.fontWeight),case:'none'});
 const barColor=await bar.evaluate(node=>getComputedStyle(node).color);
 const probe=await page.evaluate(text=>{const span=document.createElement('span');span.style.color=text;
  document.body.append(span);const color=getComputedStyle(span).color;span.remove();return color;},TEXT_COLOR);
 assert.equal(barColor,probe);
 await title.click();
 await page.locator(ListboxElement.POPOVER.selector).waitFor();
 await page.screenshot({path:join(CAPTURES,`${viewport.width}-open.png`)});
 assert.equal(await option(UNAVAILABLE.label).getAttribute('aria-disabled'),'true');
 assert.equal(Number(await option(UNAVAILABLE.label).evaluate(node=>getComputedStyle(node).opacity)),Opacity.low);
 await option(SECOND.label).click();
 await shows(SECOND);
 await chosen.click();
 await page.locator(ListboxElement.POPOVER.selector).waitFor();
 await option(UNAVAILABLE.label).click({force:true});
 await notice.waitFor();
 assert.equal(await shownName(),SECOND.label,'pressing the name opens the list and an unavailable row refuses');
 assert.equal(await notice.getAttribute('title'),UNAVAILABLE.unavailable);
 await title.focus();
 await page.keyboard.press('ArrowLeft');
 await shows(FIRST);
 assert.equal(await title.getAttribute('aria-expanded'),'false','an arrow on the closed title steps without opening');
 await page.keyboard.press('ArrowDown');
 await shows(SECOND);
 await page.keyboard.press('ArrowRight');
 assert.equal(await title.getAttribute('aria-expanded'),'false');
 assert.equal(await shownName(),SECOND.label,'stepping onto an unavailable option refuses');
 const glyph=async()=>toggle.locator(`[${TOGGLE_GLYPH_ATTRIBUTE}]`).getAttribute(TOGGLE_GLYPH_ATTRIBUTE);
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 assert.equal(await glyph(),ToggleGlyph.OFF);
 await toggle.click();
 await page.waitForFunction(name=>document.querySelector(`[aria-label="${name}"]`)?.getAttribute('aria-pressed')
  ==='true',HeaderForm.TOGGLE);
 assert.equal(await glyph(),ToggleGlyph.ON);
 assert.equal(await toggle.evaluate(node=>getComputedStyle(node).boxShadow),'none','a bare toggle draws no active box');
 await toggle.focus();
 await page.keyboard.press('Tab');
 const barButton=named(page,CompactGlyph.BAR);
 assert.equal(await barButton.evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
 assert.equal(await barButton.evaluate(node=>{node.style.setProperty('--focus-outline','none');
  return getComputedStyle(node).outlineStyle;}),'none','a header icon button reads --focus-outline');
 const barBox=await bar.boundingBox()??assert.fail('the compact bar has no box');
 const box=await toggle.boundingBox()??assert.fail('the toggle has no box');
 assert.ok(box.x>=barBox.x&&box.y>=barBox.y&&box.y+box.height<=barBox.y+barBox.height
  &&box.x+box.width<=barBox.x+barBox.width);
});

test('a title choice and its list work in a StyleProvider without app-root',async()=>{
 const page=await openScene('tests/headerGlyphScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
 await page.evaluate(([rootId,rootClass,foreignCard])=>{
  document.getElementById(rootId)?.classList.remove(rootClass);
  document.documentElement.style.setProperty('--card',foreignCard);
 },[SCENE_ROOT_ID,ApplicationElement.ROOT.className,FOREIGN_CARD] as const);
 const title=page.locator(ModuleTitleChoiceElement.selector);
 const [back,next]=[0,1].map(index=>page.locator(ListboxElement.STEP.selector).nth(index));
 const nextBox=await next.boundingBox()??assert.fail('the step caret has no box without app-root');
 assert.deepEqual({w:nextBox.width,h:nextBox.height},{w:D.moduleGrid.tabMinWidth,h:D.moduleGrid.tabMinHeight});
 const read=await page.evaluate(([choice,step,keys])=>{
  const trigger=document.querySelector(choice),caret=document.querySelectorAll(step)[1];
  const heading=trigger?.closest('h2');
  if(!trigger||!caret||!heading)throw new Error('the scene draws no title choice or step caret');
  const style=(element: Element)=>getComputedStyle(element),type=(element: Element)=>keys.map(key=>style(element)[key]);
  const bare=(element: Element)=>({border:style(element).borderTopWidth,bg:style(element).backgroundColor});
  return {heading:type(heading),word:type(trigger),triggerPad:style(trigger).paddingTop,
   triggerBare:bare(trigger),caretBare:bare(caret)};
 },[ModuleTitleChoiceElement.selector,ListboxElement.STEP.selector,TITLE_TYPE] as const);
 assert.deepEqual(read.word,read.heading,'without app-root, the title trigger still inherits its heading type');
 assert.equal(read.triggerPad,'0px');
 assert.deepEqual(read.triggerBare,{border:'0px',bg:'rgba(0, 0, 0, 0)'});
 assert.deepEqual(read.caretBare,{border:'0px',bg:'rgba(0, 0, 0, 0)'});
 await title.focus();
 await page.keyboard.press('Tab');
 assert.equal(await back.evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
 assert.equal(await back.evaluate(node=>{node.style.setProperty('--focus-outline','none');
  return getComputedStyle(node).outlineStyle;}),'none','a compact step caret reads --focus-outline without app-root');
 await title.click();
 const popover=page.locator(ListboxElement.POPOVER.selector);
 await popover.waitFor();
 const panel=await popover.evaluate(node=>({inBody:node.parentElement===document.body,
  bg:getComputedStyle(node).backgroundColor}));
 assert.equal(panel.inBody,true,'without app-root, the StyleProvider portals the list into document.body');
 assert.notEqual(panel.bg,FOREIGN_CARD,'the portaled list carries StyleProvider\'s surface instead of :root\'s');
});
