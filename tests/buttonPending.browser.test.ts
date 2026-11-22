// The pending form in Chromium, read from buttonPendingScene.tsx at a desktop and a phone width: a pending submit
// Button submits nothing, on a click or on Enter in its form; a press on a pending control with detail (a setting
// Boolean, a SegmentedControl option) leaves its detail as it was, where a live one's closes it; a consumer's own
// `data-pending` leaves a live Button as it was; a pending Button fades as a disabled one does; a live Button's label
// keeps its inline layout; an arrow onto a live tab with detail chooses it and leaves its detail open; pending tabs
// ignore their keys, focus staying on the saving tab; every pending control, each one with detail included, is busy and
// shows the busy cursor; the Poké Ball takes the pending spinner's size beside text and the mark's size over a
// selection mark, which stays; a swept SegmentedControl's saving option draws one Poké Ball, its sweep's copy hidden;
// and in each form the sweep's copy lies over its label part by part, a glyph beside text too.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {LoadingElement} from '../src/react/loadingElements.ts';
import {PENDING_FORM_ATTRIBUTE,PendingElement,PendingForm} from '../src/react/pendingElements.ts';
import {TextSweepElement} from '../src/react/motion.ts';
import {SelectionMarkElement} from '../src/react/selectionMarkElements.ts';
import {DESKTOP_VIEWPORT,PHONE_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {CHANGE_COUNT_ATTRIBUTE,PendingSceneElement,SEGMENT_OPTIONS,SUBMIT_COUNT_ATTRIBUTE}
 from './buttonPendingCases.ts';

const page=await openScene('tests/buttonPendingScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
const form=page.locator(PendingSceneElement.FORM.selector);
await form.waitFor();
const FIELD_GAP='--field-gap';
// The property each pending form sizes its Poké Ball by.
const SPINNER_SIZE: Readonly<Record<PendingForm,string>>={[PendingForm.TEXT]:'--pending-spinner-size',
 [PendingForm.MARK]:'--selection-mark'};
const pendingIn=(form: PendingForm)=>`${PendingElement.selector}[${PENDING_FORM_ATTRIBUTE}=${form}]`;

test('a pending submit Button submits nothing, on a click or on Enter',async()=>{
 await page.locator(PendingSceneElement.SUBMIT.selector).click();
 await page.locator(PendingSceneElement.FIELD.selector).press('Enter');
 // A live submit in the same form would have rendered its count by now; the form's own submit is synchronous.
 assert.equal(await form.getAttribute(SUBMIT_COUNT_ATTRIBUTE),'0');
});

test('a press on a control with detail closes its detail, and a press on a pending one changes nothing',async()=>{
 // A disabled control's press changes nothing: a pending one's press is refused the same way.
 for(const [row,stays] of [[PendingSceneElement.LIVE,false],[PendingSceneElement.PENDING,true]] as const){
  const triggers=await page.locator(`${row.selector} ${PendingSceneElement.DETAIL.selector} button`).all();
  assert.ok(triggers.length>1,row.className);
  for(const trigger of triggers){
   const detail=page.getByRole('tooltip');
   await trigger.hover();
   await detail.waitFor();
   const name=await trigger.textContent();
   await trigger.click();
   await detail.waitFor({state:stays?'visible':'detached'});
   assert.equal(await detail.count(),stays?1:0,`${row.className} ${name}`);
   // The press focused the trigger, which keeps its detail open: Escape closes it before the next.
   await page.mouse.move(0,0);
   await page.keyboard.press('Escape');
   await detail.waitFor({state:'detached'});
  }
 }
});

test('pending tabs ignore an arrow key, Home and End, as they ignore a press',async()=>{
 const tabs=page.locator(PendingSceneElement.TABS.selector);
 const selected=tabs.getByRole('tab',{selected:true});
 const saving=await selected.textContent();
 await selected.focus();
 for(const key of ['ArrowRight','ArrowLeft','Home','End']){
  await page.keyboard.press(key);
  // A live tab list would have counted the change by now; its onChange is synchronous.
  assert.equal(await tabs.getAttribute(CHANGE_COUNT_ATTRIBUTE),'0',key);
  assert.equal(await selected.textContent(),saving,key);
  // Focus stays on the saving tab: a key that moved it would leave it beside a choice it can't change.
  assert.equal(await selected.evaluate(tab=>tab===document.activeElement),true,key);
 }
});

test('an arrow key onto a live tab with detail chooses it and leaves its detail open',async()=>{
 const tabs=page.locator(PendingSceneElement.LIVE_TABS.selector);
 await tabs.getByRole('tab',{selected:true}).focus();
 await page.keyboard.press('ArrowRight');
 const detail=page.getByRole('tooltip');
 await detail.waitFor();
 assert.equal(await detail.count(),1);
 assert.equal(await tabs.getAttribute(CHANGE_COUNT_ATTRIBUTE),'1');
 assert.equal(await tabs.getByRole('tab',{selected:true}).textContent(),SEGMENT_OPTIONS[1].label);
 await page.keyboard.press('Escape');
 await detail.waitFor({state:'detached'});
});

test('the arrows come round the ends of a live tab list, and Home and End reach them',async()=>{
 const tabs=page.locator(PendingSceneElement.LIVE_TABS.selector),selected=tabs.getByRole('tab',{selected:true});
 const [first,last]=[SEGMENT_OPTIONS[0].label,SEGMENT_OPTIONS.at(-1)?.label];
 await selected.focus();
 for(const [key,reached] of [['Home',first],['ArrowLeft',last],['ArrowRight',first],['End',last]] as const){
  await page.keyboard.press(key);
  assert.equal(await selected.textContent(),reached,key);
 }
 await page.keyboard.press('Escape');
 await page.getByRole('tooltip').waitFor({state:'detached'});
});

for(const viewport of [DESKTOP_VIEWPORT,PHONE_VIEWPORT])test(`at ${viewport.width}px`,async t=>{
 await page.setViewportSize(viewport);
 await t.test('a consumer\'s own data-pending leaves a live Button as a live one',async()=>{
  const live=page.locator(`${PendingSceneElement.LIVE.selector} button`).first();
  const style=(node: Element)=>({opacity:getComputedStyle(node).opacity,cursor:getComputedStyle(node).cursor});
  assert.deepEqual(await page.locator(PendingSceneElement.CONSUMER_ATTRIBUTE.selector).evaluate(style),
   await live.evaluate(style));
 });
 await t.test('a pending Button fades as a disabled one does, and a live one does not',async()=>{
  const opacity=(node: Element)=>getComputedStyle(node).opacity;
  const pending=await page.locator(`${PendingSceneElement.PENDING.selector} button`).first().evaluate(opacity);
  assert.equal(pending,await page.locator(`${PendingSceneElement.PENDING.selector} button:disabled`).evaluate(opacity));
  assert.notEqual(pending,await page.locator(`${PendingSceneElement.LIVE.selector} button`).first().evaluate(opacity));
 });
 await t.test('a live Button\'s label keeps its inline layout',async()=>{
  const displays=await page.locator(`${PendingSceneElement.LIVE.selector} > button > *`)
   .evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).display));
  assert.ok(displays.length>0);
  for(const display of displays)assert.ok(!display.includes('flex'),display);
 });
 await t.test('every pending control is busy, and its cursor says so, the ones with detail included',async()=>{
  const BUSY={busy:'true',cursor:'progress'};
  for(const [controls,least] of [[`${PendingSceneElement.PENDING.selector} button:not(:disabled)`,1],
   [`${PendingSceneElement.PENDING.selector} ${PendingSceneElement.DETAIL.selector} button`,2]] as const){
   const states=await page.locator(controls).evaluateAll(nodes=>nodes.map(node=>
    ({busy:node.getAttribute('aria-busy'),cursor:getComputedStyle(node).cursor})));
   assert.ok(states.length>=least,controls);
   assert.deepEqual(states,states.map(()=>BUSY),controls);
  }
 });
 await t.test('the Poké Ball takes its form\'s size, and sits centred over a mark that stays',async()=>{
  // At the theme's field gap and at a wider one, so a size that only matches the mark by chance is caught.
  const gap=await page.evaluate(name=>getComputedStyle(document.documentElement).getPropertyValue(name),FIELD_GAP);
  for(const fieldGap of [gap,`calc(2 * ${gap})`])for(const form of Object.values(PendingForm)){
   await page.evaluate(([name,value])=>document.documentElement.style.setProperty(name,value),[FIELD_GAP,fieldGap]);
   const size=SPINNER_SIZE[form];
   const sizes=await page.locator(`${PendingSceneElement.PENDING.selector} ${pendingIn(form)}`)
    .evaluateAll((nodes,{ball,size})=>nodes.map(node=>{
     const probe=document.createElement('span');
     probe.style.width=`var(${size})`;probe.style.display='block';node.append(probe);
     const expected=probe.getBoundingClientRect().width;probe.remove();
     return {ball:node.querySelector(ball)?.getBoundingClientRect().width,expected};
    }),{ball:LoadingElement.POKEBALL.selector,size});
   assert.ok(sizes.length>0,`no pending ${form} form is drawn`);
   for(const {ball,expected} of sizes){assert.ok(expected>0,size);assert.equal(ball,expected,form);}
  }
  await page.evaluate(([name,value])=>document.documentElement.style.setProperty(name,value),[FIELD_GAP,gap]);
  const centres=await page.locator(`${PendingSceneElement.PENDING.selector} ${pendingIn(PendingForm.MARK)}`)
   .evaluate((node,selectors)=>selectors.map(selector=>{
    const rect=node.querySelector(selector)?.getBoundingClientRect();
    return rect&&rect.width>0?{x:rect.x+rect.width/2,y:rect.y+rect.height/2}:null;
   }),[LoadingElement.POKEBALL.selector,SelectionMarkElement.selector]);
  assert.ok(centres[1],'the pending mark is not drawn');
  assert.deepEqual(centres[0],centres[1]);
 });
 await t.test('a swept SegmentedControl\'s saving option draws one Poké Ball, in each form',async()=>{
  const segments=await page.locator(PendingSceneElement.SEGMENT.selector).all();
  assert.ok(segments.length>0);
  for(const segment of segments){
   const balls=await segment.locator(PendingElement.selector)
    .evaluateAll((pendings,{sweep,ball})=>pendings.map(pending=>{
    const spinner=pending.querySelector(ball);
    return {copy:!!pending.closest(sweep),visibility:spinner&&getComputedStyle(spinner).visibility,
     width:spinner?.getBoundingClientRect().width};
   }),{sweep:TextSweepElement.selector,ball:LoadingElement.POKEBALL.selector});
   // One pending element in the saving option's label, and one in its sweep's copy.
   assert.deepEqual(balls.map(drawn=>drawn.copy),[false,true]);
   assert.equal(balls[0].visibility,'visible');
   assert.ok((balls[0].width??0)>0,'the saving option draws no Poké Ball');
   assert.equal(balls[1].visibility,'hidden');
  }
 });
 await t.test('a swept SegmentedControl\'s sweep copy lies over its label, part by part, in each form',async()=>{
  // Each part of the label (a glyph, its text, a pending element) beside the same part of the sweep's copy.
  const parts=await page.locator(`${PendingSceneElement.SEGMENT.selector} button`)
   .evaluateAll((options,sweep)=>options.map(option=>{
    const copy=option.querySelector(sweep),label=copy?.parentElement;
    const rect=(node: Node)=>{
     const range=document.createRange();range.selectNodeContents(node);
     const {x,y,width,height}=node instanceof Element?node.getBoundingClientRect():range.getBoundingClientRect();
     return {x,y,width,height,text:node.textContent};
    };
    return {label:[...label?.childNodes??[]].filter(node=>node!==copy).map(rect),
     copy:[...copy?.childNodes??[]].map(rect)};
   }),TextSweepElement.selector);
  assert.equal(parts.length,SEGMENT_OPTIONS.length*await page.locator(PendingSceneElement.SEGMENT.selector).count());
  for(const {label,copy} of parts){assert.ok(label.length>0,'an option draws no label');assert.deepEqual(copy,label);}
 });
});
