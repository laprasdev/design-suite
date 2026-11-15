// Every Button an ActionBar holds, its notice's recovery Button included, is exactly the bar's control height, its own
// `--header-control`, and so is the bar inside its bottom line; a notice standing alone fits its Button to its own
// control height. Exact holds because the Buttons drop their block padding and the action label's line box (12px
// text) is shorter than the control. The bars' tokens reach no Button outside them: a PageFooter's action still
// stretches to the footer, and a Button outside any bar keeps its own padding and height. Read in Chromium from
// actionBarHeightScene.tsx at a desktop and a phone width.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Locator} from '../scripts/gateTools/node_modules/playwright/index.js';
import {ActionBarElement,ActionNoticeElement} from '../src/react/actionBarElements.ts';
import {HEADER_CONTROL_PROPERTY} from '../src/react/headerControl.ts';
import {DESKTOP_VIEWPORT,PHONE_VIEWPORT,openScene} from './browserScene.ts';
import {ACTION_BAR_BUTTONS,FOOTER_ACTION,NOTICE_BUTTONS,OUTSIDE_BUTTON} from './actionBarHeightCases.ts';

const page=await openScene('tests/actionBarHeightScene.tsx',DESKTOP_VIEWPORT);
const bar=page.locator(ActionBarElement.selector);
await bar.waitFor();
const controlHeight=async (owner: Locator)=>{
 const height=await owner.evaluate((node,name)=>parseFloat(getComputedStyle(node).getPropertyValue(name)),
  HEADER_CONTROL_PROPERTY);
 assert.ok(height>0,`${owner} sets no ${HEADER_CONTROL_PROPERTY}`);
 return height;
};
const button=(label: string)=>page.getByRole('button',{name:label});
const height=async (locator: Locator)=>(await locator.boundingBox()??assert.fail(`${locator} is not laid out`)).height;

for(const viewport of [DESKTOP_VIEWPORT,PHONE_VIEWPORT])test(`at ${viewport.width}px`,async t=>{
 await page.setViewportSize(viewport);
 await t.test('each Button in an ActionBar, and the bar within its line, are its control height',async()=>{
  const expected=await controlHeight(bar);
  assert.equal(await bar.evaluate(node=>node.clientHeight),expected);
  for(const label of Object.values(ACTION_BAR_BUTTONS))assert.equal(await height(button(label)),expected,label);
 });
 await t.test('a notice\'s recovery Button is the notice\'s control height, in a bar and alone',async()=>{
  for(const label of Object.values(NOTICE_BUTTONS)) {
   const notice=page.locator(ActionNoticeElement.selector,{has:button(label)});
   assert.equal(await height(button(label)),await controlHeight(notice),label);
  }
 });
 await t.test('a PageFooter\'s action stretches to the footer\'s full height',async()=>{
  assert.equal(await height(button(FOOTER_ACTION)),
   await page.getByRole('contentinfo').evaluate(node=>node.clientHeight));
 });
 await t.test('a Button outside any bar keeps its own padding and is that much taller than its label',async()=>{
  const outside=button(OUTSIDE_BUTTON);
  const {padding,frame,label}=await outside.evaluate(node=>{
   const style=getComputedStyle(node),text=node.firstElementChild;
   if(!text)throw new Error('the Button draws no label');
   return {padding:parseFloat(style.paddingTop)+parseFloat(style.paddingBottom),
    frame:parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth),
    label:text.getBoundingClientRect().height};
  });
  assert.ok(padding>0,'a bar\'s block padding reached a Button outside it');
  assert.equal(await height(outside),label+padding+frame);
 });
});
