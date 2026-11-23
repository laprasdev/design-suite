// An anchored Modal's layer. Its panel is drawn into the application root the Modal renders in — or, in a synth
// StyleProvider scope outside one, into the document's body with that scope's theme variables — above every content
// layer, so no clipping or scrolling ancestor cuts it off, and placed beside its anchor (useAnchoredPopover). A hidden
// marker where the Modal renders finds that root, and lends a panel opened at a point the palette around it. A Modal
// rendered in neither an application root nor a StyleProvider is refused: its panel would carry no tokens or layers.
import {useCallback,useRef,useState,type CSSProperties,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {useStyleContext} from '../synth/StyleContext.tsx';
import {ApplicationElement} from './applicationElements.ts';
import type {ModalAnchor} from './modalElements.ts';
import {styleThemeVariables} from './styleTheme.ts';
import {useAnchoredPopover,type PopoverPlacement} from './useAnchoredPopover.ts';

// An anchored Modal's anchor and where it goes beside it.
export interface AnchoredPlacement {
 readonly anchor: ModalAnchor;
 readonly popover: Omit<PopoverPlacement,'at'>|undefined;
}

// The layer root `node` renders in: the enclosing application root, or in a StyleProvider scope the document's body;
// refused by name when it renders in neither.
function layerRoot(node: Element,styled: boolean) {
 const root=node.closest(ApplicationElement.ROOT.selector);
 if(root)return {target:root,styled:false};
 if(styled)return {target:node.ownerDocument.body,styled:true};
 throw new Error(`An anchored Modal renders inside the ${ApplicationElement.ROOT.className} element`
  +' or a StyleProvider, the root its panel is drawn into; this one renders in neither.');
}

// The layer for a Modal anchored by `placement` (none for any other), once `mounted`: whether its panel is drawn yet,
// the element its region holds besides its panel, the style that places the panel (none off the anchored placement),
// and `drawInLayer`, which draws the panel into the root beside its marker.
export function useAnchoredLayer(placement: AnchoredPlacement|undefined,mounted: boolean,
 panel: RefObject<HTMLElement|null>) {
 const styleContext=useStyleContext();
 const marker=useRef<HTMLElement|null>(null),[layer,setLayer]=useState<ReturnType<typeof layerRoot>|null>(null);
 const hasStyle=styleContext!==null;
 const markerRef=useCallback((node: HTMLElement|null)=>{
  marker.current=node;
  setLayer(node&&layerRoot(node,hasStyle));
 },[hasStyle]);
 const anchor=placement?.anchor,element=anchor&&'current' in anchor?anchor:undefined;
 const at=anchor&&!('current' in anchor)?anchor:undefined;
 const placed=useAnchoredPopover(mounted&&layer!==null,element??marker,panel,{...placement?.popover,at});
 const style: CSSProperties|undefined=placement&&(layer?.styled&&styleContext
  ?{...styleThemeVariables(styleContext.getEffectiveStyle()),...placed}:placed);
 const drawInLayer=(content: ReactNode)=><><span hidden ref={markerRef}/>{layer&&createPortal(content,layer.target)}</>;
 return {drawn:placement===undefined||layer!==null,region:element,style,drawInLayer};
}
