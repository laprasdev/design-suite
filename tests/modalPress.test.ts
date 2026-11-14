// What else dismisses an anchored Modal: a press outside its region (which holds the regions of Modals anchored
// inside its panel), a drag starting anywhere, and opening another of its group. Contained and viewport Modals ignore
// presses and drags. The scenes run over tests/modalScene.ts.
import assert from 'node:assert/strict';
import {describe,it} from 'node:test';
import {ModalPlacement} from '../src/react/modalElements.ts';
import {FakeElement,dragFrom,inside,page,panel,pressAt,scene} from './modalScene.ts';

const trigger=(holder: FakeElement,order: number)=>({current:new FakeElement('trigger',holder,order)});

describe('Presses, drags and groups',()=>{
 it('dismiss an anchored Modal on a press outside its panel and anchor, and no other Modal on any press',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   const anchor=trigger(page,1),detailPanel=panel(page,4);
   open('dialog',panel(page,2),ModalPlacement.VIEWPORT);
   open('contained',panel(page,3),ModalPlacement.CONTAINED);
   open('detail',detailPanel,ModalPlacement.ANCHORED,{anchor});
   open('fixed',panel(page,5),ModalPlacement.ANCHORED,{dismissible:false});
   for(const target of [anchor.current,inside(detailPanel)])pressAt(target);
   assert.deepEqual(closed,[],'a press on the anchor or in the panel keeps it open');
   pressAt(inside(page));
   assert.deepEqual(closed,['detail']);
  } finally {dispose();}
 });

 it('count a list opened from inside a detail as inside the detail, wherever the list is drawn',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   const detailPanel=panel(page,2),listPanel=panel(page,6);
   open('detail',detailPanel,ModalPlacement.ANCHORED,{anchor:trigger(page,1)});
   open('list',listPanel,ModalPlacement.ANCHORED,{anchor:trigger(detailPanel,2.2)});
   pressAt(inside(listPanel));
   assert.deepEqual(closed,[],'a press in the list keeps the detail it opened from');
   pressAt(inside(page));
   assert.deepEqual(closed.sort(),['detail','list']);
  } finally {dispose();}
 });

 it('dismiss every anchored Modal when a drag starts, even from its anchor',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   const anchor=trigger(page,1);
   open('detail',panel(page,2),ModalPlacement.ANCHORED,{anchor});
   open('dialog',panel(page,3),ModalPlacement.VIEWPORT);
   open('contained',panel(page,4),ModalPlacement.CONTAINED);
   dragFrom(anchor.current);
   assert.deepEqual(closed,['detail']);
  } finally {dispose();}
 });

 it('dismiss the open Modal of a group when another of that group opens',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   open('first help',panel(page,1),ModalPlacement.ANCHORED,{group:'help'});
   open('a tool',panel(page,2),ModalPlacement.ANCHORED,{group:'tools'});
   open('second help',panel(page,3),ModalPlacement.ANCHORED,{group:'help'});
   assert.deepEqual(closed,['first help']);
  } finally {dispose();}
 });
});
