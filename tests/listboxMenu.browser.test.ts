// ListboxSelect's menu form in Chromium, read from listboxMenuScene.tsx at a desktop and a phone width: its trigger is
// a menu button and its popup a menu of menuitems, none of them chosen, where the select form beside it stays a
// combobox over a listbox that marks its chosen option; opening moves focus into the menu, on its first action;
// the arrows step through the actions and stop at the ends, Home and End reach them; Enter, Space and a click each
// run the action they are on, every time, closing the menu and returning focus to the trigger; Escape closes it with
// focus returned and runs nothing; Tab closes it and moves on; with `field` the trigger draws the select's caret; the
// open menu lies inside the window, outlined by no focus ring; and a select with a search opens on its search.
import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
import {ListboxElement} from '../src/react/listboxSelectElements.ts';
import {DESKTOP_VIEWPORT,PHONE_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {ACTION_COUNT_ATTRIBUTE,LAST_ACTION_ATTRIBUTE,MENU_ACTIONS,MENU_LABEL,MenuSceneElement,SEARCH_LABEL,SELECT_LABEL}
 from './listboxMenuCases.ts';

const page=await openScene('tests/listboxMenuScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
const root=page.locator(MenuSceneElement.ROOT.selector);
await root.waitFor();
const trigger=page.getByRole('button',{name:MENU_LABEL});
const menu=page.getByRole('menu',{name:MENU_LABEL});
const FIRST=MENU_ACTIONS[0],LAST=MENU_ACTIONS[MENU_ACTIONS.length-1];
// The action the open menu's keys are on, by the label of the item its active descendant names.
const activeAction=()=>menu.evaluate(list=>{
 const id=list.getAttribute('aria-activedescendant');
 return id?document.getElementById(id)?.getAttribute('aria-label'):null;
});
const focused=(locator: typeof trigger)=>locator.evaluate(node=>node===document.activeElement);
const runs=async()=>({count:await root.getAttribute(ACTION_COUNT_ATTRIBUTE),
 last:await root.getAttribute(LAST_ACTION_ATTRIBUTE)});
const openWith=async(key: string)=>{await trigger.focus();await page.keyboard.press(key);await menu.waitFor();};
const closed=async()=>{await menu.waitFor({state:'detached'});assert.equal(await focused(trigger),true);};
// The tests share one page: a test that fails with a popover open closes it, so the next starts closed.
const popover=page.locator(ListboxElement.POPOVER.selector);
afterEach(async()=>{
 if(!await popover.count())return;
 await page.keyboard.press('Escape');
 await popover.waitFor({state:'detached'});
});

test('the menu form is a menu button over menuitems, and the select form stays a combobox',async()=>{
 assert.equal(await trigger.getAttribute('aria-haspopup'),'menu');
 assert.equal(await trigger.getAttribute('aria-expanded'),'false');
 await trigger.click();
 await menu.waitFor();
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 assert.equal(await trigger.getAttribute('aria-controls'),await menu.getAttribute('id'));
 const items=menu.getByRole('menuitem');
 assert.deepEqual(await items.allTextContents(),MENU_ACTIONS.map(action=>action.label));
 assert.deepEqual(await items.evaluateAll(nodes=>nodes.map(node=>node.hasAttribute('aria-selected'))),
  MENU_ACTIONS.map(()=>false));
 assert.equal(await page.getByRole('option').count(),0);
 assert.equal(await focused(menu),true);
 assert.equal(await activeAction(),FIRST.label);
 await page.keyboard.press('Escape');
 await closed();
 const select=page.getByRole('combobox',{name:SELECT_LABEL});
 assert.equal(await select.getAttribute('aria-haspopup'),'listbox');
 await select.click();
 await page.getByRole('listbox').waitFor();
 assert.equal(await page.getByRole('option',{selected:true}).textContent(),FIRST.label);
 assert.equal(await focused(select),true);
 await page.keyboard.press('Escape');
 await page.getByRole('listbox').waitFor({state:'detached'});
});

test('the arrows step through the actions and stop at the ends, and Home and End reach them',async()=>{
 await openWith('ArrowDown');
 const steps=[['ArrowUp',FIRST],['ArrowDown',MENU_ACTIONS[1]],['End',LAST],['ArrowDown',LAST],
  ['ArrowUp',MENU_ACTIONS[MENU_ACTIONS.length-2]],['Home',FIRST]] as const;
 for(const [key,reached] of steps){
  await page.keyboard.press(key);
  assert.equal(await activeAction(),reached.label,key);
 }
 await page.keyboard.press('Escape');
 await closed();
});

test('Enter, Space and a click run the action they are on, every time, and return focus',async()=>{
 const before=Number((await runs()).count);
 await openWith('Enter');
 await page.keyboard.press('End');
 await page.keyboard.press('Enter');
 await closed();
 assert.deepEqual(await runs(),{count:String(before+1),last:LAST.value});
 // The menu holds no value: the action just run is the one it opens on, and runs again.
 await openWith(' ');
 assert.equal(await activeAction(),FIRST.label);
 await page.keyboard.press('End');
 await page.keyboard.press(' ');
 await closed();
 assert.deepEqual(await runs(),{count:String(before+2),last:LAST.value});
 await trigger.click();
 await menu.getByRole('menuitem',{name:MENU_ACTIONS[1].label}).click();
 await closed();
 assert.deepEqual(await runs(),{count:String(before+3),last:MENU_ACTIONS[1].value});
});

test('Escape closes the menu, returns focus and runs nothing; Tab closes it and moves on',async()=>{
 const before=await runs();
 await openWith('ArrowDown');
 await page.keyboard.press('ArrowDown');
 await page.keyboard.press('Escape');
 await closed();
 assert.deepEqual(await runs(),before);
 await openWith('ArrowDown');
 await page.keyboard.press('Tab');
 await menu.waitFor({state:'detached'});
 assert.equal(await focused(page.getByRole('combobox',{name:SELECT_LABEL})),true);
 assert.deepEqual(await runs(),before);
});

test('a select with a search opens with its search focused',async()=>{
 await page.getByRole('combobox',{name:SEARCH_LABEL}).click();
 const list=page.getByRole('listbox',{name:SEARCH_LABEL});
 await list.waitFor();
 assert.equal(await focused(popover.getByRole('combobox')),true);
 await page.keyboard.press('Escape');
 await list.waitFor({state:'detached'});
});

for(const viewport of [DESKTOP_VIEWPORT,PHONE_VIEWPORT])test(`at ${viewport.width}px the open menu lies in the window`,
 async()=>{
  await page.setViewportSize(viewport);
  await trigger.click();
  await menu.waitFor();
  const box=await popover.boundingBox();
  assert.ok(box,'the menu is not drawn');
  assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height,
   JSON.stringify(box));
  assert.ok(box.width>=(await trigger.boundingBox()??assert.fail('no trigger')).width);
  // The trigger draws the list's one caret, as the select does, and the focused menu no outline beside its active
  // item's wash.
  const carets=(scope: typeof trigger)=>scope.locator(ListboxElement.CARET.selector).count();
  assert.equal(await carets(page.getByRole('combobox',{name:SELECT_LABEL})),1);
  assert.equal(await carets(trigger),1);
  assert.equal(await menu.evaluate(node=>getComputedStyle(node).outlineStyle),'none');
  await page.keyboard.press('Escape');
  await closed();
 });
