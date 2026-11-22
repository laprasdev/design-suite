// The pending form's accessible names in Chromium, read from buttonPendingScene.tsx: a pending control keeps the name
// its live one has, so a busy control is still found by what it is.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {PendingSceneElement} from './buttonPendingCases.ts';

const page=await openScene('tests/buttonPendingScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
await page.locator(PendingSceneElement.FORM.selector).waitFor();
// A control's accessible name, the quoted name on the first line of its own ARIA snapshot.
const ACCESSIBLE_NAME=/^- \S+ "(.+?)"/;
const names=async(row: {readonly selector: string})=>Promise.all((await page.locator(`${row.selector} button`).all())
 .map(async control=>ACCESSIBLE_NAME.exec(await control.ariaSnapshot())?.[1]??''));
// Rows each control in has a name; the tab and swept rows' saving options say what they save, with no live twin.
const NAMED_ROWS=[PendingSceneElement.LIVE,PendingSceneElement.TABS,PendingSceneElement.SEGMENT] as const;

test('a pending control keeps its accessible name: the pending row is named as the live one',async()=>{
 assert.deepEqual(await names(PendingSceneElement.PENDING),await names(PendingSceneElement.LIVE));
 for(const row of NAMED_ROWS){
  const named=await names(row);
  assert.ok(named.length>0&&named.every(Boolean),`${row.selector}: ${named}`);
 }
});
