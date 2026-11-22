// The synth's anchored Modals in Chromium, read from synthPopoversScene.tsx: a value's refusal belongs to the edit that
// made it, so a press on the value and an in-range number leave no refusal; and a cycling Enum's picker opens above it.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT,openScene,SCENE_GL} from './browserScene.ts';
import {ENUM_OPTIONS,SynthPopoverElement,VALUE_LIMITS} from './synthPopoversCases.ts';

const page=await openScene('tests/synthPopoversScene.tsx',DESKTOP_VIEWPORT,SCENE_GL.software);
const value=page.locator(`${SynthPopoverElement.VALUE.selector} [data-editable-value]`);
const refusal=page.getByRole('alert');
await value.waitFor();
const typed=async(number: number)=>{
 await value.click();
 const box=page.locator(`${SynthPopoverElement.VALUE.selector} input`);
 await box.fill(String(number));
 await box.press('Enter');
};

test('a press on the value and an in-range number leave no refusal behind',async()=>{
 await typed(VALUE_LIMITS.max+1);
 await refusal.waitFor();
 await typed(VALUE_LIMITS.min);
 await value.filter({hasText:String(VALUE_LIMITS.min)}).waitFor();
 assert.equal(await refusal.count(),0,'the refusal of the earlier edit is gone');
});

test('a cycling Enum\'s picker opens above it',async()=>{
 const control=page.locator(`${SynthPopoverElement.ENUM.selector} button`);
 await control.press('ArrowDown');
 const picker=page.getByRole('button',{name:ENUM_OPTIONS.at(-1)?.label});
 await picker.waitFor();
 const [above,below]=await Promise.all([picker.boundingBox(),control.boundingBox()]);
 assert.ok(above&&below&&above.y+above.height<=below.y,'the picker\'s options sit above the control');
});
