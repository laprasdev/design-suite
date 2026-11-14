// Which of the things Escape does goes first. What is under way hears it first, and a Modal around it stays open; then
// a Modal, then the focused control; a selection hears it last, once every Modal and focused control has let it pass.
// The scenes run over tests/modalScene.ts.
import assert from 'node:assert/strict';
import {describe,it} from 'node:test';
import {ModalPlacement} from '../src/react/modalElements.ts';
import {FakeElement,inside,page,panel,press,scene,type Rendered} from './modalScene.ts';

type Controls=Awaited<ReturnType<typeof scene>>['controls'];
// A selection on the page that Escape clears, as a graph's nodes or wires.
function selection(controls: Controls) {
 const held={selected:true};
 controls.useEscapeCancel(controls.EscapeCancel.SELECTION,()=>{
  if(!held.selected)return false;
  held.selected=false;return true;
 });
 return held;
}
// A focused control that cancels its own edit or reshape on Escape, as a Knob's value or a group's edge does.
function editing(controls: Controls) {
 const edit={underWay:true};
 const control: Rendered={props:{onKeyDown:event=>void controls.cancelsOnEscape(event,()=>{
  if(!edit.underWay)return false;
  edit.underWay=false;return true;
 })}};
 return {edit,control};
}

describe('Escape',()=>{
 it('cancels a node move or a tie drag inside a viewport Modal, and the Modal stays open',async()=>{
  for(const gesture of ['node move','tie drag'] as const)for(const focus of ['the dialog','nothing'] as const) {
   const {open,closed,controls,dispose}=await scene();
   try {
    let cancelled=0;
    // Mounted with the dialog's content, whose effects run before the dialog's own.
    if(gesture==='node move')controls.useEscapeCancel(controls.EscapeCancel.UNDER_WAY,()=>{cancelled++;return true;});
    else controls.useDragSession(true,{end:()=>{},cancel:()=>{cancelled++;}});
    const dialogPanel=panel(page,1),dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
    press(focus==='the dialog'?inside(dialogPanel):null,[dialog]);
    assert.equal(cancelled,1,`${gesture}, focus on ${focus}: cancelled`);
    assert.deepEqual(closed,[],`${gesture}, focus on ${focus}: the dialog stays open`);
   } finally {dispose();}
  }
 });

 it('closes a dialog over a selection, and keeps the selection',async()=>{
  for(const focus of ['the dialog','nothing'] as const) {
   const {open,closed,controls,dispose}=await scene();
   try {
    const held=selection(controls),dialogPanel=panel(page,1);
    const dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
    press(focus==='the dialog'?inside(dialogPanel):null,[dialog]);
    assert.deepEqual(closed,['dialog'],`focus on ${focus}`);
    assert.ok(held.selected,`focus on ${focus}: the selection is kept`);
   } finally {dispose();}
  }
 });

 it('closes an open hover detail while a selection exists, and clears the selection after it',async()=>{
  for(const focus of ['nothing','a control on the page'] as const) {
   const {open,closed,controls,dispose}=await scene();
   try {
    const held=selection(controls);
    open('detail',panel(page,2),ModalPlacement.ANCHORED,{anchor:{current:new FakeElement('trigger',page,1)}});
    press(focus==='nothing'?null:inside(page),[]);
    assert.deepEqual(closed,['detail'],`focus on ${focus}`);
    assert.equal(held.selected,false,`focus on ${focus}: the key goes on to the selection, as before`);
   } finally {dispose();}
  }
 });

 it('cancels a focused control\'s own edit or reshape while a selection exists, and keeps the selection',async()=>{
  for(const where of ['on the page','inside a dialog'] as const) {
   const {open,closed,controls,dispose}=await scene();
   try {
    const held=selection(controls),{edit,control}=editing(controls);
    if(where==='on the page')press(inside(page),[control]);
    else {
     const dialogPanel=panel(page,1),dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
     press(inside(dialogPanel),[control,dialog]);
    }
    assert.equal(edit.underWay,false,`${where}: the control cancelled`);
    assert.ok(held.selected,`${where}: the selection is kept`);
    assert.deepEqual(closed,[],`${where}: no dialog closes`);
   } finally {dispose();}
  }
 });
});
