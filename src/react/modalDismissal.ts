// How an open Modal is dismissed, decided here and nowhere else. A Modal's region is its panel and, for an anchored
// Modal that names one, its anchor: the element it opens from. A region also holds the regions of the Modals anchored
// inside its panel, so a list opened from a detail counts as inside the detail wherever it is drawn.
// Escape goes to one receiver. The innermost open Modal whose own panel or anchor holds the focus receives it and
// stops it there; a contained or anchored Modal receives an Escape only so. The topmost viewport Modal receives every
// other Escape and stops it before anything outside it sees the key. With no viewport Modal open, the topmost anchored
// Modal receives an Escape that no region holds, wherever the focus is, and lets the key go on to the focused control:
// content shown on hover closes on Escape without moving pointer or focus (WCAG 1.4.13), and a control still cancels
// what it was doing. The receiver closes if it is dismissible; a key that a control inside its panel has already
// handled (its default prevented) stops at the receiver without closing it.
// A press outside an anchored Modal's region, or a drag starting anywhere, dismisses it if it is dismissible, and the
// press goes on to what it lands on. Opening an anchored Modal of a group dismisses the others of that group.
// Dismissed with focus in its panel, which would be lost with it, an anchored Modal hands focus back to its anchor.
import {useEffect,type KeyboardEvent as ReactKeyboardEvent,type RefObject} from 'react';
import {ModalPlacement,type ModalPlacementValue} from './modalElements.ts';

const ESCAPE='Escape';
interface OpenModal {
 readonly panel: Element;
 readonly anchor: RefObject<HTMLElement|null>|undefined;
 readonly placement: ModalPlacementValue;
 readonly group: string|undefined;
 dismiss(handled: boolean): void;
}
interface Receiver {readonly modal: OpenModal; readonly stops: boolean}
// Every open Modal, by its panel.
const openModals=new Map<Element,OpenModal>();

// The part of a Modal's own region that holds the node: its panel or its anchor.
const ownPart=(modal: OpenModal,node: Node)=>[modal.panel,modal.anchor?.current].find(part=>part?.contains(node));
// Whether the node is in the Modal's region: its own part, or the region of an open Modal anchored inside its panel.
// The walk takes each Modal once, so Modals anchored in each other's panels end it.
function regionHolds(modal: OpenModal,node: Node) {
 const region=[modal];
 for(const outer of region) {
  if(ownPart(outer,node))return true;
  for(const inner of openModals.values()) {
   const anchor=inner.anchor?.current;
   if(anchor&&!region.includes(inner)&&outer.panel.contains(anchor))region.push(inner);
  }
 }
 return false;
}
// The open Modal of a placement latest in the document, which is drawn above the others at its layer.
function topmost(placement: ModalPlacementValue) {
 let top: OpenModal|undefined;
 for(const modal of openModals.values())if(modal.placement===placement&&
  (!top||top.panel.compareDocumentPosition(modal.panel)&Node.DOCUMENT_POSITION_FOLLOWING))top=modal;
 return top;
}
// The open Modal whose own panel or anchor holds the target most closely.
function holder(target: EventTarget|null) {
 if(!(target instanceof Node))return;
 let held: {modal: OpenModal,part: Element}|undefined;
 for(const modal of openModals.values()) {
  const part=ownPart(modal,target);
  if(part&&(!held||held.part.contains(part)))held={modal,part};
 }
 return held?.modal;
}
// Who receives an Escape aimed at the target, and whether the key stops there.
function receiver(target: EventTarget|null): Receiver|undefined {
 const held=holder(target),top=topmost(ModalPlacement.VIEWPORT);
 if(held&&(held.placement!==ModalPlacement.VIEWPORT||held===top))return {modal:held,stops:true};
 if(top)return {modal:top,stops:true};
 const anchored=topmost(ModalPlacement.ANCHORED);
 return anchored&&{modal:anchored,stops:false};
}
// A receiver whose panel holds the target takes the key from its panel, after what is inside it; any other, here.
function captureEscape(event: KeyboardEvent) {
 const received=event.key===ESCAPE?receiver(event.target):undefined;
 if(!received||event.target instanceof Node&&received.modal.panel.contains(event.target))return;
 if(received.stops)event.stopPropagation();
 received.modal.dismiss(event.defaultPrevented);
}
// Dismisses every open anchored Modal that `keeps` does not keep.
function dismissAnchored(keeps: (modal: OpenModal)=>boolean) {
 for(const modal of [...openModals.values()])
  if(modal.placement===ModalPlacement.ANCHORED&&!keeps(modal))modal.dismiss(false);
}
function pressOutside(event: PointerEvent) {
 const target=event.target instanceof Node?event.target:null;
 dismissAnchored(modal=>!!target&&regionHolds(modal,target));
}
const dragStarts=()=>dismissAnchored(()=>false);
function listen() {
 window.addEventListener('keydown',captureEscape,true);window.addEventListener('pointerdown',pressOutside,true);
 window.addEventListener('dragstart',dragStarts,true);
}
function stopListening() {
 window.removeEventListener('keydown',captureEscape,true);window.removeEventListener('pointerdown',pressOutside,true);
 window.removeEventListener('dragstart',dragStarts,true);
}

export interface ModalDismissal {
 readonly open: boolean;
 readonly placement: ModalPlacementValue;
 readonly anchor: RefObject<HTMLElement|null>|undefined;
 readonly group: string|undefined;
 readonly dismissible: boolean;
 // Read when the Modal is dismissed.
 readonly onClose: RefObject<(() => void)|undefined>;
}
// Registers an open Modal and returns its panel's handler for the Escape it receives from inside.
export function useModalDismissal(panel: RefObject<Element>,
 {open,placement,anchor,group,dismissible,onClose}: ModalDismissal) {
 useEffect(()=>{
  const node=panel.current;
  if(!open||!node)return;
  if(group)dismissAnchored(modal=>modal.group!==group);
  openModals.set(node,{panel:node,anchor,placement,group,dismiss:handled=>{
   if(!dismissible||handled)return;
   if(node.contains(document.activeElement))anchor?.current?.focus();
   onClose.current?.();
  }});
  if(openModals.size===1)listen();
  return()=>{
   openModals.delete(node);
   if(!openModals.size)stopListening();
  };
 },[panel,open,placement,anchor,group,dismissible,onClose]);
 return (event: ReactKeyboardEvent)=>{
  const received=event.key===ESCAPE?receiver(event.target):undefined;
  if(!received||received.modal.panel!==panel.current)return;
  event.stopPropagation();
  received.modal.dismiss(event.defaultPrevented);
 };
}
