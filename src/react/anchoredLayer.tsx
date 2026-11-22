// An anchored Modal's layer. Its panel is drawn into the application root the Modal renders in, above every content
// layer, so no clipping or scrolling ancestor cuts it off, and placed beside its anchor (useAnchoredPopover). A hidden
// marker where the Modal renders finds that root, and lends a panel opened at a point the palette around it. A Modal
// rendered outside an application root is refused: its panel would carry none of the root's tokens or layers.
import {useCallback,useRef,useState,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {ApplicationElement} from './applicationElements.ts';
import type {ModalAnchor} from './modalElements.ts';
import {useAnchoredPopover,type PopoverPlacement} from './useAnchoredPopover.ts';

// An anchored Modal's anchor and where it goes beside it.
export interface AnchoredPlacement {
 readonly anchor: ModalAnchor;
 readonly popover: Omit<PopoverPlacement,'at'>|undefined;
}

// The application root `node` renders in, refused by name when it renders in none.
function applicationRoot(node: Element) {
 const root=node.closest(ApplicationElement.ROOT.selector);
 if(!root)throw new Error(`An anchored Modal renders inside the ${ApplicationElement.ROOT.className} element`
  +', the application root its panel is drawn into; this one renders in none.');
 return root;
}

// The layer for a Modal anchored by `placement` (none for any other), once `mounted`: whether its panel is drawn yet,
// the element its region holds besides its panel, the style that places the panel (none off the anchored placement),
// and `drawInLayer`, which draws the panel into the root beside its marker.
export function useAnchoredLayer(placement: AnchoredPlacement|undefined,mounted: boolean,
 panel: RefObject<HTMLElement|null>) {
 const marker=useRef<HTMLElement|null>(null),[root,setRoot]=useState<Element|null>(null);
 const markerRef=useCallback((node: HTMLElement|null)=>{
  marker.current=node;
  setRoot(node&&applicationRoot(node));
 },[]);
 const anchor=placement?.anchor,element=anchor&&'current' in anchor?anchor:undefined;
 const at=anchor&&!('current' in anchor)?anchor:undefined;
 const style=useAnchoredPopover(mounted&&root!==null,element??marker,panel,{...placement?.popover,at});
 const drawInLayer=(content: ReactNode)=><><span hidden ref={markerRef}/>{root&&createPortal(content,root)}</>;
 return {drawn:placement===undefined||root!==null,region:element,style:placement&&style,drawInLayer};
}
