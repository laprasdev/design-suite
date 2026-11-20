// Each width a Modal names, read from its panel's computed width in Chromium (modalWidthScene.tsx): the README's widths
// in the viewport, a stage of 24 control hit sizes, and a contained Modal filling its frame inside the page's inset or
// gutter, or outside a page surface the theme's inset. A Modal naming no width keeps the width every Modal had before
// it could name one, and a contained Modal given a top sits that far below its frame's top edge, past the inset or
// within it; a negative top is refused.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {Locator} from '../scripts/gateTools/node_modules/playwright/index.js';
import {ModalElement,ModalForm,ModalPlacement,MODAL_WIDTH_ATTRIBUTE,ModalWidth,modalShape}
 from '../src/react/modalElements.ts';
import {DESKTOP_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {CASE_ATTRIBUTE,CONTAINED_PARENT,MODAL_WIDTH_PX,ModalCase,THEME_INSET_PX,VIEWPORT_WIDTHS}
 from './modalWidthCases.ts';

const page=await openScene('tests/modalWidthScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);

const inCase=(name: string,selector: string)=>page.locator(`[${CASE_ATTRIBUTE}="${name}"] ${selector}`);
const panel=(name: string)=>inCase(name,ModalElement.PANEL.selector);
const computedWidth=(name: string)=>panel(name).evaluate(node=>parseFloat(getComputedStyle(node).width));
const box=async (locator: Locator)=>await locator.boundingBox()??assert.fail(`${locator} is not laid out`);
await panel(ModalCase.TOP_IN_INSET).waitFor();

for(const width of VIEWPORT_WIDTHS)test(`a viewport Modal named ${width} is ${MODAL_WIDTH_PX[width]}px wide`,async()=>{
 assert.equal(await computedWidth(width),MODAL_WIDTH_PX[width]);
});
test('a contained Modal named fill takes its frame inside the page\'s inset',async()=>{
 assert.equal(await computedWidth(ModalWidth.FILL),MODAL_WIDTH_PX[ModalWidth.FILL]);
});
test('a contained frame kept the page\'s gutter from its parent narrows fill by that gutter',async()=>{
 assert.equal(await computedWidth(ModalCase.GUTTER),CONTAINED_PARENT.widthPx-2*CONTAINED_PARENT.pageGutterPx);
});
test('a Modal naming no width is compact, or titled when it has a title',async()=>{
 for(const [name,width] of [[ModalCase.PLAIN,ModalWidth.COMPACT],[ModalCase.TITLED,ModalWidth.TITLED]] as const) {
  assert.equal(await panel(name).getAttribute(MODAL_WIDTH_ATTRIBUTE),width,name);
  assert.equal(await computedWidth(name),MODAL_WIDTH_PX[width],name);
 }
});
test('a contained frame outside a page surface keeps the theme\'s inset',async()=>{
 assert.equal(await computedWidth(ModalCase.OUTSIDE_PAGE),CONTAINED_PARENT.widthPx-2*THEME_INSET_PX);
});
const TOPS=[[ModalCase.TOP,CONTAINED_PARENT.topPx],[ModalCase.TOP_IN_INSET,CONTAINED_PARENT.topInInsetPx]] as const;
for(const [name,top] of TOPS)
 test(`a contained Modal given a top of ${top}px sits that far below its frame's top edge, centred across it`,async()=>{
  const frame=await box(inCase(name,ModalElement.FRAME.selector)),placed=await box(panel(name));
  assert.equal(placed.y-frame.y,top);
  assert.equal(placed.x+placed.width/2,frame.x+frame.width/2);
 });
test('a contained Modal refuses a negative or non-finite top',()=>{
 for(const top of [-1,Number.NaN,Number.POSITIVE_INFINITY])assert.throws(()=>modalShape({form:ModalForm.DIALOG,
  placement:ModalPlacement.CONTAINED,titled:false,top}),RangeError,String(top));
});
