// The scene the Modal dismissal tests play in: real Modals rendered once, open, with every effect run at once (their
// hooks replaced), over the few parts of the DOM the router reads: which elements hold a node, the panels' order in
// the document, and the focused element. Each scene has a fresh bundle and window, so no Modal of another stays open.
import assert from 'node:assert/strict';
import {ModalElement,type ModalPlacementValue} from '../src/react/modalElements.ts';
import {bundled,replacedHooks} from './bundled.ts';

const OPEN_AT_ONCE=`export const useState = initial => [typeof initial === 'function' ? initial() : initial, () => {}];
export const useRef = current => ({current});
export const useEffect = effect => { effect(); }, useLayoutEffect = effect => { effect(); };`;
const ESCAPE='Escape';

class FakeNode extends EventTarget {
 static readonly DOCUMENT_POSITION_PRECEDING=2;
 static readonly DOCUMENT_POSITION_FOLLOWING=4;
}
export class FakeElement extends FakeNode {
 readonly className: string;
 readonly parentElement: FakeElement|null;
 readonly order: number;
 constructor(className: string,parentElement: FakeElement|null,order: number) {
  super();
  this.className=className;this.parentElement=parentElement;this.order=order;
 }
 contains(other: unknown) {
  for(let node=other instanceof FakeElement?other:null;node;node=node.parentElement)if(node===this)return true;
  return false;
 }
 focus() {Object.assign(document,{activeElement:this});}
 compareDocumentPosition(other: FakeElement) {
  return other.order>this.order?FakeNode.DOCUMENT_POSITION_FOLLOWING:FakeNode.DOCUMENT_POSITION_PRECEDING;
 }
}
export interface KeyPress {
 readonly key: string;
 readonly target: FakeElement|null;
 defaultPrevented: boolean;
 preventDefault(): void;
 stopPropagation(): void;
}
export interface Rendered {props: {children?: unknown; onKeyDown?(event: KeyPress): void}}
interface ModalProps {
 open: boolean; onClose(): void; placement: ModalPlacementValue; panelRef: {current: FakeElement};
 anchor?: {current: FakeElement}; group?: string; dismissible?: boolean; onKeyDown?(event: KeyPress): void;
}
interface ModalModule {Modal(props: ModalProps & {children?: unknown}): Rendered|null}

export const page=new FakeElement('page',null,0);
export const panel=(parent: FakeElement,order: number)=>new FakeElement(ModalElement.PANEL.className,parent,order);
export const inside=(holder: FakeElement)=>new FakeElement('control',holder,holder.order+.5);
// The element that handles keys: the panel, inside the frame of a Modal that has one.
const keyed=(node: unknown): Rendered=>{
 if(!node||typeof node!=='object'||!('props' in node))throw new Error('A Modal renders its panel.');
 const shown=node as Rendered;
 return shown.props.onKeyDown?shown:keyed(shown.props.children);
};

export async function scene() {
 Object.assign(globalThis,{window:new EventTarget(),document:new EventTarget(),Node:FakeNode,Element:FakeElement,
  requestAnimationFrame:()=>0});
 const {module,dispose}=await bundled<ModalModule>(['src/react/Modal.tsx'],[replacedHooks(OPEN_AT_ONCE)]);
 const closed: string[]=[];
 const open=(name: string,holder: FakeElement,placement: ModalPlacementValue,props: Partial<ModalProps>={})=>
  keyed(module.Modal({open:true,onClose:()=>closed.push(name),placement,panelRef:{current:holder},...props}));
 return {open,closed,dispose};
}
export type Opener=Awaited<ReturnType<typeof scene>>['open'];
// An event of the type at the target, as the window hears it.
function dispatch(type: string,target: FakeElement|null,key?: string) {
 const event=new Event(type);
 if(key)Object.defineProperty(event,'key',{value:key});
 if(target)Object.defineProperty(event,'target',{value:target});
 window.dispatchEvent(event);
 return event;
}
// One Escape at the target (none: focus on nothing): the window's listeners, then the key handlers of the given
// elements around the target, innermost first, until one stops it, as React passes a key up through them.
export function press(target: FakeElement|null,around: readonly Rendered[]) {
 let stopped=dispatch('keydown',target,ESCAPE).cancelBubble;
 const key: KeyPress={key:ESCAPE,target,defaultPrevented:false,
  preventDefault() {key.defaultPrevented=true;},stopPropagation() {stopped=true;}};
 for(const element of around)if(!stopped)element.props.onKeyDown?.(key);
 return stopped;
}
export const pressAt=(target: FakeElement)=>void dispatch('pointerdown',target);
export const dragFrom=(target: FakeElement)=>void dispatch('dragstart',target);

interface Escaped {readonly closes: string; readonly stopped: boolean; readonly stops: boolean}
// Each focus in a scene of its own: `act` opens the Modals and presses Escape with that focus. Only the Modal it
// names closes, and the key stops there or goes on, as `stops` says.
export async function eachFocus<Focus extends string>(focuses: readonly Focus[],
 act: (focus: Focus,open: Opener)=>Escaped) {
 for(const focus of focuses) {
  const {open,closed,dispose}=await scene();
  try {
   const {closes,stopped,stops}=act(focus,open);
   assert.deepEqual(closed,[closes],`focus on ${focus}`);
   assert.equal(stopped,stops,`focus on ${focus}: the key ${stops?'stops':'goes on'}`);
  } finally {dispose();}
 }
}
