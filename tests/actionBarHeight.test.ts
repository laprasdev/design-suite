// Every Button a compact ActionBar holds is exactly the bar's control height, its own `--header-control`, and so is
// the bar inside its bottom line, read in Chromium from actionBarHeightScene.tsx at a desktop and a phone width.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ActionBarElement} from '../src/react/actionBarElements.ts';
import {openScene} from './browserScene.ts';
import {ACTION_BAR_BUTTONS,ACTION_BAR_VIEWPORTS} from './actionBarHeightCases.ts';

const CONTROL_HEIGHT='--header-control';
const [desktop]=ACTION_BAR_VIEWPORTS;
const page=await openScene('tests/actionBarHeightScene.tsx',desktop);
const bar=page.locator(ActionBarElement.selector);
await bar.waitFor();
const controlHeight=async ()=>bar.evaluate((node,name)=>parseFloat(getComputedStyle(node).getPropertyValue(name)),
 CONTROL_HEIGHT);
const height=async (label: string)=>(await page.getByRole('button',{name:label}).boundingBox()
 ??assert.fail(`the ${label} button is not laid out`)).height;

const CASE='each Button in a compact ActionBar, and the bar within its line, are its control height';
for(const viewport of ACTION_BAR_VIEWPORTS)test(`at ${viewport.width}px ${CASE}`,async()=>{
 await page.setViewportSize(viewport);
 const expected=await controlHeight();
 assert.ok(expected>0,`the action bar sets no ${CONTROL_HEIGHT}`);
 assert.equal(await bar.evaluate(node=>node.clientHeight),expected);
 for(const label of Object.values(ACTION_BAR_BUTTONS))assert.equal(await height(label),expected,label);
});
