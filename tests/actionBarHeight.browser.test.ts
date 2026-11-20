// Every Button an ActionBar holds is exactly the bar's control height, its own `--header-control`, and so is the bar
// inside its bottom line. A notice, in a bar or alone, with a recovery Button or without, is that control height
// tall, its Button inside its line. Exact holds because the Buttons drop their block padding and the action label's
// line box (12px text) is shorter than the control. The bars' tokens reach no Button outside them: a PageFooter's
// action stretches to a footer its setting makes taller, is the footer's control height on a surface scaled flat, is
// its min width (PHI squared control heights) at a phone width where its label is narrower, and a Button outside any
// bar keeps its own padding, the same at its block start and end, and its height. Under a safe area, a footer's action
// pads only its block end to it. Read in Chromium from actionBarHeightScene.tsx, on a page
// surface, at a desktop and a phone width.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Locator} from '../scripts/gateTools/node_modules/playwright/index.js';
import {ActionBarElement,ActionNoticeElement} from '../src/react/actionBarElements.ts';
import {HEADER_CONTROL_PROPERTY} from '../src/react/headerControl.ts';
import {PHI_SQUARED} from '../src/goldenRatio.ts';
import {DESKTOP_VIEWPORT,PHONE_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {ACTION_BAR_BUTTONS,FOOTER_ACTIONS,LAYOUT_UNIT,NOTICE_BUTTONS,OUTSIDE_BUTTON,SAFE_AREA}
 from './actionBarHeightCases.ts';

const page=await openScene('tests/actionBarHeightScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
const bar=page.locator(ActionBarElement.selector);
await bar.waitFor();
const notices=page.locator(ActionNoticeElement.ROOT.selector);
const button=(label: string)=>page.getByRole('button',{name:label});
const footer=(action: string)=>page.getByRole('contentinfo').filter({has:button(action)});
const controlHeight=async (owner: Locator)=>{
 const height=await owner.evaluate((node,name)=>parseFloat(getComputedStyle(node).getPropertyValue(name)),
  HEADER_CONTROL_PROPERTY);
 assert.ok(height>0,`${owner} sets no ${HEADER_CONTROL_PROPERTY}`);
 return height;
};
// An element's laid-out height, the height inside its block borders, and its block padding, in CSS pixels.
const box=(locator: Locator)=>locator.evaluate(node=>{
 const style=getComputedStyle(node),{height}=node.getBoundingClientRect();
 return {height,inner:height-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth),
  padding:parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)};
});
// A Button in a bar or a notice drops its block padding and is `expected` tall.
const fits=async (label: string,expected: number)=>{
 const {height,padding}=await box(button(label));
 assert.equal(padding,0,`${label} keeps its block padding`);
 assert.equal(height,expected,label);
};

for(const viewport of [DESKTOP_VIEWPORT,PHONE_VIEWPORT])test(`at ${viewport.width}px`,async t=>{
 await page.setViewportSize(viewport);
 await t.test('each Button in an ActionBar, and the bar within its line, are its control height',async()=>{
  const expected=await controlHeight(bar);
  assert.equal((await box(bar)).inner,expected);
  for(const label of Object.values(ACTION_BAR_BUTTONS))await fits(label,expected);
 });
 await t.test('a notice is the bar\'s control height in a bar and alone, its recovery Button inside its line',
  async()=>{
   const expected=await controlHeight(bar);
   assert.equal(await notices.count(),Object.keys(NOTICE_BUTTONS).length+1);
   for(const notice of await notices.all())assert.equal((await box(notice)).height,expected,`${notice}`);
   for(const label of Object.values(NOTICE_BUTTONS))
    await fits(label,(await box(notices.filter({has:button(label)}))).inner);
  });
 await t.test('a PageFooter\'s action stretches to a footer its setting makes taller',async()=>{
  const set=footer(FOOTER_ACTIONS.set),{inner}=await box(set);
  assert.ok(inner>await controlHeight(set),'the footer is no taller than its control height');
  assert.equal((await box(button(FOOTER_ACTIONS.set))).height,inner);
 });
 await t.test('a PageFooter\'s action is the footer\'s control height on a surface scaled flat',async()=>{
  const flat=footer(FOOTER_ACTIONS.flat),expected=await controlHeight(flat);
  assert.equal((await box(button(FOOTER_ACTIONS.flat))).height,expected);
  assert.equal((await box(flat)).inner,expected);
 });
 await t.test('a Button outside any bar keeps its own padding and is that much taller than its label',async()=>{
  const outside=button(OUTSIDE_BUTTON);
  const {start,end,padding,frame,label}=await outside.evaluate(node=>{
   const style=getComputedStyle(node),text=node.firstElementChild;
   if(!text)throw new Error('the Button draws no label');
   const start=parseFloat(style.paddingTop),end=parseFloat(style.paddingBottom);
   return {start,end,padding:start+end,frame:parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth),
    label:text.getBoundingClientRect().height};
  });
  assert.ok(padding>0,'a bar\'s block padding reached a Button outside it');
  assert.equal(start,end,'a Button outside any bar sets its block start and end apart');
  assert.equal((await box(outside)).height,label+padding+frame);
 });
});
test(`at ${PHONE_VIEWPORT.width}px, a PageFooter's action is its min width, wider than its label`,async()=>{
 await page.setViewportSize(PHONE_VIEWPORT);
 const action=button(FOOTER_ACTIONS.set),expected=await controlHeight(footer(FOOTER_ACTIONS.set))*PHI_SQUARED;
 const {width,content}=await action.evaluate(node=>{
  const style=getComputedStyle(node),text=node.firstElementChild;
  if(!text)throw new Error('the Button draws no label');
  return {width:node.getBoundingClientRect().width,content:text.getBoundingClientRect().width
   +parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)};
 });
 assert.ok(content<expected,`the label, ${content} wide, not the min width, ${expected}, sets the action's width`);
 assert.ok(Math.abs(width-expected)<LAYOUT_UNIT,`${width} is not ${expected}`);
});
test('a PageFooter\'s action pads its block end, not its start, to the bottom safe area',async()=>{
 const action=button(FOOTER_ACTIONS.set);
 const blockPadding=()=>action.evaluate(node=>{
  const style=getComputedStyle(node);
  return {start:parseFloat(style.paddingTop),end:parseFloat(style.paddingBottom)};
 });
 const {start}=await blockPadding(),insets=await page.context().newCDPSession(page);
 assert.ok(start<SAFE_AREA.bottom,'the safe area is no deeper than the footer\'s padding');
 await insets.send('Emulation.setSafeAreaInsetsOverride',{insets:SAFE_AREA});
 assert.deepEqual(await blockPadding(),{start,end:SAFE_AREA.bottom});
 await insets.send('Emulation.setSafeAreaInsetsOverride',{insets:{}});
});
