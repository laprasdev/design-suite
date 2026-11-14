// Escape goes to one receiver and stops there: the innermost open Modal that receives it. A contained or anchored
// Modal receives an Escape only from inside its panel; the topmost viewport Modal receives every other one. Each
// scene renders real Modals once, open, with every effect run at once, over the few parts of the DOM the router
// reads: which panels hold a node, and the panels' order in the document.
import assert from 'node:assert/strict';
import {describe,it} from 'node:test';
import {ModalElement,ModalPlacement,type ModalPlacementValue} from '../src/react/modalElements.ts';
import {bundled,replacedHooks} from './bundled.ts';

const OPEN_AT_ONCE=`export const useState = initial => [typeof initial === 'function' ? initial() : initial, () => {}];
export const useRef = current => ({current});
export const useEffect = effect => { effect(); }, useLayoutEffect = effect => { effect(); };`;
const ESCAPE='Escape';

class FakeNode extends EventTarget {
 static readonly DOCUMENT_POSITION_PRECEDING=2;
 static readonly DOCUMENT_POSITION_FOLLOWING=4;
}
class FakeElement extends FakeNode {
 readonly className: string;
 readonly parentElement: FakeElement|null;
 readonly order: number;
 constructor(className: string,parentElement: FakeElement|null,order: number) {
  super();
  this.className=className;this.parentElement=parentElement;this.order=order;
 }
 closest(selector: string) {
  for(let node: FakeElement|null=this;node;node=node.parentElement)if(selector===`.${node.className}`)return node;
  return null;
 }
 contains(other: unknown) {
  for(let node=other instanceof FakeElement?other:null;node;node=node.parentElement)if(node===this)return true;
  return false;
 }
 compareDocumentPosition(other: FakeElement) {
  return other.order>this.order?FakeNode.DOCUMENT_POSITION_FOLLOWING:FakeNode.DOCUMENT_POSITION_PRECEDING;
 }
}
interface KeyPress {
 readonly key: string;
 readonly target: FakeElement|null;
 defaultPrevented: boolean;
 preventDefault(): void;
 stopPropagation(): void;
}
interface Rendered {props: {children?: unknown; onKeyDown?(event: KeyPress): void}}
interface ModalProps {
 open: boolean; onClose(): void; placement: ModalPlacementValue; panelRef: {current: FakeElement};
 dismissible?: boolean; onKeyDown?(event: KeyPress): void; children?: unknown;
}
interface ModalModule {Modal(props: ModalProps): Rendered|null}

const page=new FakeElement('page',null,0);
const panel=(parent: FakeElement,order: number)=>new FakeElement(ModalElement.PANEL.className,parent,order);
const inside=(holder: FakeElement)=>new FakeElement('control',holder,holder.order+.5);
// The element that handles keys: the panel, inside the frame of a Modal that has one.
const keyed=(node: unknown): Rendered=>{
 if(!node||typeof node!=='object'||!('props' in node))throw new Error('A Modal renders its panel.');
 const shown=node as Rendered;
 return shown.props.onKeyDown?shown:keyed(shown.props.children);
};

// A fresh bundle and window for each scene, so no Modal of another scene stays open.
async function scene() {
 Object.assign(globalThis,{window:new EventTarget(),Node:FakeNode,Element:FakeElement,requestAnimationFrame:()=>0});
 const {module,dispose}=await bundled<ModalModule>(['src/react/Modal.tsx'],[replacedHooks(OPEN_AT_ONCE)]);
 const closed: string[]=[];
 const open=(name: string,holder: FakeElement,placement: ModalPlacementValue,props: Partial<ModalProps>={})=>
  keyed(module.Modal({open:true,onClose:()=>closed.push(name),placement,panelRef:{current:holder},...props}));
 return {open,closed,dispose};
}
// One Escape at the target (none: focus on nothing): the window's listeners, then the key handlers of the given
// elements around the target, innermost first, until one stops it, as React passes a key up through them.
function press(target: FakeElement|null,around: readonly Rendered[]) {
 const event=new Event('keydown');
 Object.defineProperty(event,'key',{value:ESCAPE});
 if(target)Object.defineProperty(event,'target',{value:target});
 window.dispatchEvent(event);
 let stopped=event.cancelBubble;
 const key: KeyPress={key:ESCAPE,target,defaultPrevented:false,
  preventDefault() {key.defaultPrevented=true;},stopPropagation() {stopped=true;}};
 for(const element of around)if(!stopped)element.props.onKeyDown?.(key);
 return stopped;
}
type Opener=Awaited<ReturnType<typeof scene>>['open'];
interface Escaped {readonly stopped: boolean; readonly closes: string}
// Each focus in a scene of its own: `act` opens the Modals and presses Escape with that focus. Only the Modal it
// names closes, and the key stops there.
async function eachFocus<Focus extends string>(focuses: readonly Focus[],act: (focus: Focus,open: Opener)=>Escaped) {
 for(const focus of focuses) {
  const {open,closed,dispose}=await scene();
  try {
   const {stopped,closes}=act(focus,open);
   assert.deepEqual(closed,[closes],`focus on ${focus}`);
   assert.ok(stopped,`focus on ${focus}: nothing outside the receiver sees the key`);
  } finally {dispose();}
 }
}

describe('Escape',()=>{
 it('closes only the topmost of two viewport Modals, wherever focus is, and stops there',()=>
  eachFocus(['nothing','inner','outer'] as const,(focus,open)=>{
   const outerPanel=panel(page,1),innerPanel=panel(outerPanel,2);
   const outer=open('outer',outerPanel,ModalPlacement.VIEWPORT),inner=open('inner',innerPanel,ModalPlacement.VIEWPORT);
   const stopped=focus==='nothing'?press(null,[]):focus==='inner'?press(inside(innerPanel),[inner,outer])
    :press(inside(outerPanel),[outer]);
   return {stopped,closes:'inner'};
  }));

 it('gives a contained panel inside a viewport Modal the Escape from inside it, and the Modal every other',()=>
  eachFocus(['contained','dialog','nothing'] as const,(focus,open)=>{
   const dialogPanel=panel(page,1),containedPanel=panel(dialogPanel,2);
   const dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
   const contained=open('contained',containedPanel,ModalPlacement.CONTAINED);
   if(focus==='contained')return {stopped:press(inside(containedPanel),[contained,dialog]),closes:'contained'};
   return {stopped:focus==='dialog'?press(inside(dialogPanel),[dialog]):press(null,[]),closes:'dialog'};
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

 it('stops at an anchored Modal that handles the key itself, as HoverDetail does',async()=>{
  const {open,closed,dispose}=await scene();
  try {
   const dialogPanel=panel(page,1),detailPanel=panel(page,2);
   const dialog=open('dialog',dialogPanel,ModalPlacement.VIEWPORT);
   const detail=open('detail',detailPanel,ModalPlacement.ANCHORED,{dismissible:false,
    onKeyDown:event=>{if(event.key===ESCAPE){event.preventDefault();closed.push('detail itself');}}});
   assert.ok(press(inside(detailPanel),[detail,dialog]));
   assert.deepEqual(closed,['detail itself']);
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
