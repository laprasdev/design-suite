// The Buttons a surface sizes from its own rules, a node graph's resize edges, group output handle and twist tie and
// the sky's theme moon, take that size through the Button's tokens: none keeps the Button's padding, and a twist tie
// is the size its wires give it. A group's heading is the graph's heading height, its label inset as far as the
// group insets its members. Read in Chromium from buttonSurfacesScene.tsx at a desktop and a phone width.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GROUP_SPACE} from '../src/react/groupGeometry.ts';
import {NODE_HEADING_HEIGHT_PROPERTY,NodeGraphElement} from '../src/react/nodeGraphElements.ts';
import {TIE_SIZE,tieWidth} from '../src/react/wireGeometry.ts';
import {DESKTOP_VIEWPORT,PHONE_VIEWPORT,openScene} from './browserScene.ts';
import {SizedButtonElement,TIED_EDGES} from './buttonSurfacesCases.ts';

const page=await openScene('tests/buttonSurfacesScene.tsx',DESKTOP_VIEWPORT);
const tie=page.locator(SizedButtonElement.TIE.selector);
await tie.waitFor();

for(const viewport of [DESKTOP_VIEWPORT,PHONE_VIEWPORT])test(`at ${viewport.width}px`,async t=>{
 await page.setViewportSize(viewport);
 await t.test('a Button a surface sizes keeps none of the Button\'s padding',async()=>{
  for(const [name,{selector}] of Object.entries(SizedButtonElement)) {
   const buttons=page.locator(selector);
   assert.ok(await buttons.count()>0,`the scene draws no ${name} Button`);
   for(const padding of await buttons.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).padding)))
    assert.equal(padding,'0px',name);
  }
 });
 await t.test('a twist tie is the size its wires give it',async()=>{
  const size=await tie.evaluate(node=>node instanceof HTMLElement&&{width:node.offsetWidth,height:node.offsetHeight});
  assert.deepEqual(size,{width:tieWidth(TIED_EDGES.length),height:TIE_SIZE.height});
 });
 await t.test('a group\'s heading is the graph\'s heading height, its label at the group\'s inset',async()=>{
  const {height,expected,inset}=await page.locator(NodeGraphElement.GROUP_HEADING.selector).evaluate((node,name)=>{
   const frame=node.getBoundingClientRect(),label=node.firstElementChild;
   if(!label)throw new Error('the heading draws no label');
   return {height:frame.height,expected:parseFloat(getComputedStyle(node).getPropertyValue(name)),
    inset:label.getBoundingClientRect().left-frame.left};
  },NODE_HEADING_HEIGHT_PROPERTY);
  assert.ok(expected>0,`the graph sets no ${NODE_HEADING_HEIGHT_PROPERTY}`);
  assert.equal(height,expected);
  assert.equal(inset,GROUP_SPACE.inset);
 });
});
