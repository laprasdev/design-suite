// Who receives an Escape. The innermost open Modal whose own panel or anchor holds the focus receives it and stops it;
// the topmost viewport Modal receives every other one and stops it; with no viewport Modal open, the topmost anchored
// Modal receives an Escape no region holds, wherever the focus is, and lets it go on to the focused control. The
// scenes run over tests/modalScene.ts. The first three are main's rule too and do not tell the routers apart: main's
// router walks panels with closest(), which these fakes leave out, so it throws on them.
import assert from 'node:assert/strict';
import {describe,it} from 'node:test';
import {ModalPlacement} from '../src/react/modalElements.ts';
import {FakeElement,eachFocus,inside,page,panel,press,scene,type Rendered} from './modalScene.ts';

const trigger=(order: number)=>({current:new FakeElement('trigger',page,order)});

describe('Escape',()=>{
 it('closes only the topmost of two viewport Modals, wherever focus is, and stops there',()=>
  eachFocus(['nothing','inner','outer'] as const,(focus,open)=>{
   const outerPanel=panel(page,1),innerPanel=panel(outerPanel,2);
   const outer=open('outer',outerPanel,ModalPlacement.VIEWPORT),inner=open('inner',innerPanel,ModalPlacement.VIEWPORT);
   const stopped=focus==='nothing'?press(null,[]):focus==='inner'?press(inside(innerPanel),[inner,outer])
    :press(inside(outerPanel),[outer]);
   return {closes:'inner',stopped,stops:true};
  }));

 it('gives a contained panel inside a viewport Modal the Escape from inside it, and the Modal every other',()=>
  eachFocus(['contained','dialog','nothing'] as const,(focus,open)=>{
   const dialogPanel=panel(page,1),containedPanel=panel(dialogPanel,2);
   const dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
   const contained=open('contained',containedPanel,ModalPlacement.CONTAINED);
   if(focus==='contained')
    return {closes:'contained',stopped:press(inside(containedPanel),[contained,dialog]),stops:true};
   return {closes:'dialog',stopped:focus==='dialog'?press(inside(dialogPanel),[dialog]):press(null,[]),stops:true};
  }));

 it('reaches a contained Modal only from inside its panel',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   const holder=panel(page,1),contained=open('contained',holder,ModalPlacement.CONTAINED);
   assert.equal(press(null,[]),false);
   assert.deepEqual(closed,[],'an Escape aimed elsewhere passes it by');
   assert.ok(press(inside(holder),[contained]));
   assert.deepEqual(closed,['contained']);
  } finally {dispose();}
 });

 it('reaches an anchored Modal from its panel or its anchor first, even inside a dialog',()=>
  eachFocus(['panel','anchor','dialog'] as const,(focus,open)=>{
   const dialogPanel=panel(page,1),detailPanel=panel(page,3);
   const anchor={current:new FakeElement('trigger',dialogPanel,1.2)};
   const dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
   const detail=open('detail',detailPanel,ModalPlacement.ANCHORED,{anchor});
   if(focus==='panel')return {closes:'detail',stopped:press(inside(detailPanel),[detail,dialog]),stops:true};
   if(focus==='anchor')return {closes:'detail',stopped:press(anchor.current,[dialog]),stops:true};
   return {closes:'dialog',stopped:press(inside(dialogPanel),[dialog]),stops:true};
  }));

 it('gives an Escape no region holds to the topmost anchored Modal, wherever focus is, and lets it go on',async()=>{
  for(const focus of ['nothing','a control on the page'] as const) {
   const {open,closed,dispose}=await scene();
   try {
    // Opened in the reverse of document order: the receiver is the one drawn above, not the one opened last.
    open('hovered detail',panel(page,2),ModalPlacement.ANCHORED,{anchor:trigger(1.5)});
    open('earlier detail',panel(page,1),ModalPlacement.ANCHORED,{anchor:trigger(.5)});
    let seen=false;
    const control: Rendered={props:{onKeyDown:()=>{seen=true;}}};
    const stopped=focus==='nothing'?press(null,[]):press(inside(page),[control]);
    assert.deepEqual(closed,['hovered detail'],`focus on ${focus}`);
    assert.equal(stopped,false,`focus on ${focus}: the key goes on`);
    assert.equal(seen,focus!=='nothing','the focused control still sees the key');
   } finally {dispose();}
  }
 });

 it('gives that Escape to a viewport Modal instead, when one is open',()=>
  eachFocus(['nothing','a control on the page'] as const,(focus,open)=>{
   open('detail',panel(page,1),ModalPlacement.ANCHORED,{anchor:trigger(.5)});
   open('dialog',panel(page,2),ModalPlacement.VIEWPORT);
   return {closes:'dialog',stopped:focus==='nothing'?press(null,[]):press(inside(page),[]),stops:true};
  }));

 it('hands focus back to an anchored Modal\'s anchor when it is dismissed with focus in its panel',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   const anchor=trigger(1),detailPanel=panel(page,2),control=inside(detailPanel);
   const detail=open('detail',detailPanel,ModalPlacement.ANCHORED,{anchor});
   control.focus();
   press(control,[detail]);
   assert.deepEqual(closed,['detail']);
   assert.equal(document.activeElement,anchor.current);
  } finally {dispose();}
 });

 it('stops without closing when a control inside the receiver has handled it',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   const holder=panel(page,1),dialog=open('dialog',holder,ModalPlacement.VIEWPORT);
   const control: Rendered={props:{onKeyDown:event=>event.preventDefault()}};
   assert.ok(press(inside(holder),[control,dialog]));
   assert.deepEqual(closed,[]);
  } finally {dispose();}
 });
});
