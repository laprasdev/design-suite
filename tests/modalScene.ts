// The scene the Modal dismissal tests play in: real Modals rendered once, open, as Components (renderedHooks.ts), over
// the few parts of the DOM the router reads: which elements hold a node, the panels' order in the document, and the
// focused element. The controls that cancel on Escape run in it too, and a graph's node moves and wire gestures, which
// also read pointer capture and a box. Each scene has a fresh bundle and window, so no Modal or control of another
// stays open. The window hears an event in its capture phase, then React's handlers see it, then the window hears it
// in its bubble phase, each only if nothing has stopped it.
import assert from 'node:assert/strict';
import {ModalElement,type ModalPlacementValue} from '../src/react/modalElements.ts';
import type {NodeSelection} from '../src/react/nodeGraphTypes.ts';
import {bundled,replacedHooks} from './bundled.ts';
import {Component,STATEFUL_HOOKS,rendered} from './renderedHooks.ts';

export const BOX_PX=100;
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
 readonly #held=new Set<number>();
 setPointerCapture(pointer: number) {this.#held.add(pointer);}
 hasPointerCapture(pointer: number) {return this.#held.has(pointer);}
 releasePointerCapture(pointer: number) {this.#held.delete(pointer);}
 // No element around it is a button, a link or the like.
 closest() {return null;}
 // Nor does it hold wire paths to sweep.
 querySelectorAll() {return [];}
 getBoundingClientRect() {return {left:0,top:0,width:BOX_PX,height:BOX_PX};}
 compareDocumentPosition(other: FakeElement) {
  return other.order>this.order?FakeNode.DOCUMENT_POSITION_FOLLOWING:FakeNode.DOCUMENT_POSITION_PRECEDING;
 }
}
export interface KeyPress {
 readonly key: string;
 readonly target: FakeElement|null;
 readonly defaultPrevented: boolean;
 preventDefault(): void;
 stopPropagation(): void;
}
export interface Rendered {props: {children?: unknown; onKeyDown?(event: KeyPress): void}}
interface ModalProps {
 open: boolean; onClose(): void; placement: ModalPlacementValue; panelRef: {current: FakeElement};
 anchor?: {current: FakeElement}; group?: string; dismissible?: boolean; onKeyDown?(event: KeyPress): void;
}
// A press on an element, as a graph hook reads it.
export interface Press {
 readonly button: number; readonly shiftKey: boolean; readonly pointerId: number; readonly clientX: number;
 readonly clientY: number; readonly target: FakeElement; readonly currentTarget: FakeElement;
 stopPropagation(): void; preventDefault(): void;
}
export interface Tie {readonly id: string; readonly x: number; readonly y: number; readonly edges: readonly string[]}
// The hooks of controls that drag: a graph's node moves and wire gestures, and a knob.
interface DragHooks {
 useNodeMoving(nodes: readonly {id: string; x: number; y: number; w: number; h: number}[],width: number,moves: object,
  onMovesChange: (moves: object)=>void): {surface: {current: FakeElement|null}; selection: NodeSelection;
  nodeProps(id: string): {'data-selected'?: boolean; onPointerDown(press: Press): void;
   onPointerUp(press: Press): void}};
 useWireGestures(surface: {current: FakeElement},width: number,links: readonly {id: string}[],ties: readonly Tie[],
  onChange: (ties: readonly Tie[])=>void,onCollect: ()=>void,interactionSurface: undefined,outlets: object,
  onOutletsChange: undefined,nodeSelection: NodeSelection|undefined): {
  selected: readonly string[]; select(id: string,add: boolean): void; startTie(press: Press,tie: Tie): void};
 useControlBehavior(value: number,onChange: (value: number)=>void,options: {min: number; max: number}): {
  isDragging: boolean; handleMouseDown(press: Press): void};
}
interface SceneModule extends Controls,DragHooks {Modal(props: ModalProps & {children?: unknown}): Rendered|null}
type Controls=typeof import('../src/react/controlCancel.ts')&typeof import('../src/react/useDragSession.ts');
type ListenerOptions=boolean|AddEventListenerOptions|undefined;
const inCapture=(options: ListenerOptions)=>typeof options==='boolean'?options:!!options?.capture;
// The window's listeners, apart by phase.
class FakeWindow {
 readonly capture=new EventTarget();
 readonly bubble=new EventTarget();
 addEventListener(type: string,listener: EventListenerOrEventListenerObject,options?: ListenerOptions) {
  (inCapture(options)?this.capture:this.bubble).addEventListener(type,listener);
 }
 removeEventListener(type: string,listener: EventListenerOrEventListenerObject,options?: ListenerOptions) {
  (inCapture(options)?this.capture:this.bubble).removeEventListener(type,listener);
 }
}
let pageWindow=new FakeWindow();

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
 pageWindow=new FakeWindow();
 Object.assign(globalThis,{window:pageWindow,document:new EventTarget(),Node:FakeNode,Element:FakeElement,
  requestAnimationFrame:()=>0});
 const {module,dispose}=await bundled<SceneModule>(['src/react/Modal.tsx','src/react/controlCancel.ts',
  'src/react/useDragSession.ts','src/react/useNodeMoving.ts','src/react/useWireGestures.ts',
  'src/synth/components/synth/base/useControlBehavior.ts'],
  [replacedHooks(STATEFUL_HOOKS)]);
 const closed: string[]=[];
 // A component rendered and committed once.
 const mount=<Out>(hooks: ()=>Out)=>{
  const component=new Component(hooks);
  rendered(component);
  return component;
 };
 const open=(name: string,holder: FakeElement,placement: ModalPlacementValue,props: Partial<ModalProps>={})=>
  keyed(mount(()=>module.Modal({open:true,onClose:()=>closed.push(name),placement,panelRef:{current:holder},
   ...props})).now);
 const controls: Controls&DragHooks=module;
 return {open,closed,controls,mount,dispose};
}
export type Opener=Awaited<ReturnType<typeof scene>>['open'];
// An event of the type at the target, carrying the fields, as the page makes it.
function made(type: string,target: FakeElement|null,fields: object) {
 const event=new Event(type,{cancelable:true});
 for(const [field,value] of Object.entries(target?{...fields,target}:fields))
  Object.defineProperty(event,field,{value});
 return event;
}
// The window hears the event in one phase unless it has been stopped, and says whether it has been.
const hear=(event: Event,phase: EventTarget)=>{
 if(!event.cancelBubble)phase.dispatchEvent(event);
 return event.cancelBubble;
};
// One Escape at the target (none: focus on nothing): the window's capture listeners, then the key handlers of the
// given elements around the target, innermost first, as React passes a key up through them, then the window's bubble
// listeners, until one stops it. Says whether one did.
export function press(target: FakeElement|null,around: readonly Rendered[]) {
 const event=made('keydown',target,{key:ESCAPE});
 const key: KeyPress={key:ESCAPE,target,get defaultPrevented() {return event.defaultPrevented;},
  preventDefault() {event.preventDefault();},stopPropagation() {event.stopPropagation();}};
 hear(event,pageWindow.capture);
 for(const element of around)if(!event.cancelBubble)element.props.onKeyDown?.(key);
 return hear(event,pageWindow.bubble);
}
// An event of the type at the target (none: at the window itself) that only the window hears.
const windowHears=(type: string,target: FakeElement|null,fields: object)=>{
 const event=made(type,target,fields);
 hear(event,pageWindow.capture);hear(event,pageWindow.bubble);
};
export const pressAt=(target: FakeElement)=>windowHears('pointerdown',target,{});
export const windowBlurs=()=>windowHears('blur',null,{});
export const mouseMoves=(fields: {readonly clientY: number; readonly buttons: number})=>
 windowHears('mousemove',null,fields);
// A pointer event of the type on the element, as the element's own listeners hear it; says whether one took it.
export function pointerOn(element: FakeElement,type: string,fields: object) {
 const event=made(type,element,fields);
 element.dispatchEvent(event);
 return event.defaultPrevented;
}
export const dragFrom=(target: FakeElement)=>windowHears('dragstart',target,{});

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
