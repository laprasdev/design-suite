// Which of the things Escape does goes first. What is under way hears it first, and a Modal around it stays open; then
// what is open over the content, then the focused control; a selection hears it with the page after focus, once every
// Modal and focused control has let it pass. Inside a NodeGraph, Escape that cancels what is under way clears both its
// selections. The window losing focus ends a knob drag and cancels a wire gesture. The scenes run over
// tests/modalScene.ts, the graph and the knob as their real hooks.
import assert from 'node:assert/strict';
import {describe,it} from 'node:test';
import {ModalPlacement} from '../src/react/modalElements.ts';
import {KeyMoment} from '../src/react/pageKeys.ts';
import {BOX_PX,FakeElement,inside,mouseMoves,page,panel,pointerOn,press,scene,windowBlurs,type Press,type Rendered,
 type Tie} from './modalScene.ts';
import {Component,rendered} from './renderedHooks.ts';

type Scene=Awaited<ReturnType<typeof scene>>;
// A selection on the page that Escape clears.
function selection({controls,mount}: Scene) {
 const held={selected:true};
 mount(()=>controls.useEscapeCancel(KeyMoment.PAGE_AFTER_FOCUS,()=>{
  if(!held.selected)return false;
  held.selected=false;return true;
 }));
 return held;
}
// A focused control that cancels its own edit or reshape on Escape, as a Knob's value or a group's edge does.
function editing({controls}: Scene) {
 const edit={underWay:true};
 const control: Rendered={props:{onKeyDown:event=>void controls.cancelsOnEscape(event,()=>{
  if(!edit.underWay)return false;
  edit.underWay=false;return true;
 })}};
 return {edit,control};
}
const pressOn=(element: FakeElement,shiftKey: boolean): Press=>({button:0,shiftKey,pointerId:1,clientX:0,clientY:0,
 target:element,currentTarget:element,stopPropagation() {},preventDefault() {}});
const NODE={id:'a',x:10,y:10,w:20,h:20},TIE: Tie={id:'t',x:50,y:50,edges:['ab','cd']},LINKS=[{id:'ab'},{id:'cd'}];
// A NodeGraph's node moves and wires, composed as NodeGraph composes them: the wires get the node selection, and
// commit first, as GraphWires does inside it.
function graph({controls}: Scene) {
 const surface=new FakeElement('graph',page,1),node=new FakeElement('node',surface,1.1);
 const drawn={ties:[TIE] as readonly Tie[]};
 const nodes=new Component(()=>controls.useNodeMoving([NODE],BOX_PX,{},()=>{}));
 const wires=new Component(()=>controls.useWireGestures({current:surface},BOX_PX,LINKS,drawn.ties,
  ties=>{drawn.ties=ties;},()=>{},undefined,{},undefined,nodes.now.selection));
 rendered(nodes,wires);
 nodes.now.surface.current=surface;
 const props=()=>nodes.now.nodeProps(NODE.id);
 return {surface,nodes,wires,drawn,nodeSelected:()=>!!props()['data-selected'],
  // Shift and a press on the node select it; NodeGraph renders again, and GraphWires with it.
  selectNode() {
   props().onPointerDown(pressOn(node,true));props().onPointerUp(pressOn(node,true));rendered(nodes,wires);
  },
  moveNode:()=>props().onPointerDown(pressOn(node,false))};
}

describe('Escape',()=>{
 it('cancels a node move or a tie drag inside a viewport Modal, and the Modal stays open',async()=>{
  for(const gesture of ['node move','tie drag'] as const)for(const focus of ['the dialog','nothing'] as const) {
   const {open,closed,controls,mount,dispose}=await scene();
   try {
    let cancelled=0;
    // Mounted with the dialog's content, whose effects run before the dialog's own.
    if(gesture==='node move')mount(()=>controls.useEscapeCancel(KeyMoment.UNDER_WAY,()=>{cancelled++;return true;}));
    else mount(()=>controls.useDragSession(true,{cancel:()=>{cancelled++;},lostFocus:()=>{cancelled++;}}));
    const dialogPanel=panel(page,1),dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
    press(focus==='the dialog'?inside(dialogPanel):null,[dialog]);
    assert.equal(cancelled,1,`${gesture}, focus on ${focus}: cancelled`);
    assert.deepEqual(closed,[],`${gesture}, focus on ${focus}: the dialog stays open`);
   } finally {dispose();}
  }
 });

 it('cancels what is under way before a Modal decides, whichever began hearing keys first',async()=>{
  for(const first of ['the dialog','what is under way'] as const) {
   const {open,closed,controls,mount,dispose}=await scene();
   try {
    let cancelled=0;
    const underWay=()=>mount(()=>controls.useEscapeCancel(KeyMoment.UNDER_WAY,()=>{cancelled++;return true;}));
    if(first==='what is under way')underWay();
    open('dialog',panel(page,1),ModalPlacement.VIEWPORT);
    // With nothing on the page reading keys before the dialog opened, a reader mounting inside it later.
    if(first==='the dialog')underWay();
    press(null,[]);
    assert.equal(cancelled,1,`${first} first: cancelled`);
    assert.deepEqual(closed,[],`${first} first: the dialog stays open`);
   } finally {dispose();}
  }
 });

 it('closes a dialog over a selection, and keeps the selection',async()=>{
  for(const focus of ['the dialog','nothing'] as const) {
   const played=await scene();
   try {
    const held=selection(played),dialogPanel=panel(page,1);
    const dialog=played.open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
    press(focus==='the dialog'?inside(dialogPanel):null,[dialog]);
    assert.deepEqual(played.closed,['dialog'],`focus on ${focus}`);
    assert.ok(held.selected,`focus on ${focus}: the selection is kept`);
   } finally {played.dispose();}
  }
 });

 it('closes an open hover detail while a selection exists, and clears the selection after it',async()=>{
  for(const focus of ['nothing','a control on the page'] as const) {
   const played=await scene();
   try {
    const held=selection(played);
    played.open('detail',panel(page,2),ModalPlacement.ANCHORED,{anchor:{current:new FakeElement('trigger',page,1)}});
    press(focus==='nothing'?null:inside(page),[]);
    assert.deepEqual(played.closed,['detail'],`focus on ${focus}`);
    assert.equal(held.selected,false,`focus on ${focus}: the key goes on to the selection, as before`);
   } finally {played.dispose();}
  }
 });

 it('cancels a focused control\'s own edit or reshape while a selection exists, and keeps the selection',async()=>{
  for(const where of ['on the page','inside a dialog'] as const) {
   const played=await scene();
   try {
    const held=selection(played),{edit,control}=editing(played);
    if(where==='on the page')press(inside(page),[control]);
    else {
     const dialogPanel=panel(page,1),dialog=played.open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
     press(inside(dialogPanel),[control,dialog]);
    }
    assert.equal(edit.underWay,false,`${where}: the control cancelled`);
    assert.ok(held.selected,`${where}: the selection is kept`);
    assert.deepEqual(played.closed,[],`${where}: no dialog closes`);
   } finally {played.dispose();}
  }
 });

 it('clears a graph\'s node selection when it cancels a wire sweep under way',async()=>{
  const played=await scene();
  try {
   const drawn=graph(played);
   drawn.selectNode();
   assert.ok(drawn.nodeSelected(),'Shift and a press select the node');
   assert.ok(pointerOn(drawn.surface,'pointerdown',{button:0,shiftKey:true,pointerId:1,clientX:5,clientY:5}),
    'Shift and a press on the surface start a sweep');
   rendered(drawn.wires);
   press(null,[]);
   rendered(drawn.nodes,drawn.wires);
   assert.equal(drawn.nodeSelected(),false,'the node selection is cleared');
   assert.deepEqual(drawn.drawn.ties,[TIE],'nothing is tied');
  } finally {played.dispose();}
 });

 it('clears a graph\'s wire selection when it cancels a move of its nodes under way',async()=>{
  const played=await scene();
  try {
   const drawn=graph(played);
   // Selecting a wire renders GraphWires again, and not NodeGraph.
   drawn.wires.now.select('ab',false);rendered(drawn.wires);
   assert.deepEqual(drawn.wires.now.selected,['ab']);
   drawn.moveNode();
   press(null,[]);
   rendered(drawn.nodes,drawn.wires);
   assert.deepEqual(drawn.wires.now.selected,[],'the wire selection is cleared');
  } finally {played.dispose();}
 });
});

describe('The window losing focus',()=>{
 it('ends a knob drag where it reached, and cancels a wire gesture',async()=>{
  const played=await scene();
  try {
   const knob={value:50};
   const dial=new Component(()=>played.controls.useControlBehavior(knob.value,value=>{knob.value=value;},
    {min:0,max:100}));
   rendered(dial);
   dial.now.handleMouseDown(pressOn(new FakeElement('knob',page,1),false));rendered(dial);
   mouseMoves({clientY:-20,buttons:1});
   const reached=knob.value;
   assert.notEqual(reached,50,'the knob turns');
   const drawn=graph(played);
   drawn.wires.now.startTie(pressOn(new FakeElement('tie',drawn.surface,1.2),false),TIE);rendered(drawn.wires);
   pointerOn(drawn.surface,'pointermove',{pointerId:1,clientX:30,clientY:30});
   assert.notDeepEqual(drawn.drawn.ties,[TIE],'the tie moves');
   windowBlurs();
   rendered(dial);rendered(drawn.nodes,drawn.wires);
   assert.equal(knob.value,reached,'the knob keeps where it reached');
   assert.equal(dial.now.isDragging,false,'the knob drag has ended');
   mouseMoves({clientY:-40,buttons:1});
   assert.equal(knob.value,reached,'and a later move turns nothing');
   assert.deepEqual(drawn.drawn.ties,[TIE],'the wire gesture is cancelled');
  } finally {played.dispose();}
 });
});
