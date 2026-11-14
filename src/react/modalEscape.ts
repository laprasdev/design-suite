// Escape goes to one receiver and stops there: the innermost open Modal that receives it. A contained or anchored
// Modal receives an Escape only from inside its panel. The topmost viewport Modal receives every other one, before
// anything outside it sees the key. The receiver closes if it is dismissible; a key that a control inside it has
// already handled (its default prevented) stops at the receiver without closing it.
import {useEffect,type KeyboardEvent as ReactKeyboardEvent,type RefObject} from 'react';
import {ModalElement,ModalPlacement,type ModalPlacementValue} from './modalElements.ts';

const ESCAPE='Escape';
interface OpenModal {
 readonly panel: Element;
 readonly viewport: boolean;
 escape(handled: boolean): void;
}
// Every open Modal, by its panel.
const openModals=new Map<Element,OpenModal>();

// The open viewport Modal latest in the document, which is drawn above the others.
function topmostViewport() {
 let top: OpenModal|undefined;
 for(const modal of openModals.values())
  if(modal.viewport&&(!top||top.panel.compareDocumentPosition(modal.panel)&Node.DOCUMENT_POSITION_FOLLOWING))top=modal;
 return top;
}
// The open Modal whose panel holds the target most closely.
function holder(target: EventTarget|null) {
 let panel: Element|null|undefined=target instanceof Element?target.closest(ModalElement.PANEL.selector):null;
 for(;panel;panel=panel.parentElement?.closest(ModalElement.PANEL.selector)) {
  const modal=openModals.get(panel);
  if(modal)return modal;
 }
}
// The Modal that receives an Escape aimed at the target: the one holding it, unless that is a viewport Modal
// beneath the topmost one, and otherwise the topmost viewport Modal.
function receiver(target: EventTarget|null) {
 const top=topmostViewport(),held=holder(target);
 return held&&(!held.viewport||held===top)?held:top;
}
// A receiver that holds the target takes the key from its panel, after what is inside it; any other takes it here.
function captureEscape(event: KeyboardEvent) {
 const modal=event.key===ESCAPE?receiver(event.target):undefined;
 if(!modal||event.target instanceof Node&&modal.panel.contains(event.target))return;
 event.stopPropagation();
 modal.escape(event.defaultPrevented);
}

export interface ModalEscape {
 readonly open: boolean;
 readonly placement: ModalPlacementValue;
 readonly dismissible: boolean;
 // Read when the key arrives.
 readonly onClose: RefObject<(() => void)|undefined>;
}
// Registers an open Modal as a receiver and returns its panel's handler for the Escape it receives from inside.
export function useModalEscape(panel: RefObject<Element>,{open,placement,dismissible,onClose}: ModalEscape) {
 useEffect(()=>{
  const node=panel.current;
  if(!open||!node)return;
  openModals.set(node,{panel:node,viewport:placement===ModalPlacement.VIEWPORT,escape:handled=>{
   if(dismissible&&!handled)onClose.current?.();
  }});
  if(openModals.size===1)window.addEventListener('keydown',captureEscape,true);
  return()=>{
   openModals.delete(node);
   if(!openModals.size)window.removeEventListener('keydown',captureEscape,true);
  };
 },[panel,open,placement,dismissible,onClose]);
 return (event: ReactKeyboardEvent)=>{
  const modal=event.key===ESCAPE?receiver(event.target):undefined;
  if(!modal||modal.panel!==panel.current)return;
  event.stopPropagation();
  modal.escape(event.defaultPrevented);
 };
}
