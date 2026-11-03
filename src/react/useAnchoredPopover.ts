import {useLayoutEffect,useState,type CSSProperties,type RefObject} from 'react';
import {cssRect,cssViewport} from './cssZoom.ts';

// Where a popover portaled to the app root sits beside its anchor: this far from
// the anchor and from the viewport's edges, hidden while less than the minimum
// height fits on either side.
export const POPOVER_GAP=8,VIEWPORT_EDGE=8,POPOVER_MIN_HEIGHT=24;
// The palette a popover carries from its anchor, so a team-coloured section's
// popover keeps that team's colours outside it.
const ANCHOR_STYLE: readonly `--${string}`[]=['--pink','--teal','--pink-deep','--pink-wash','--header-control','--header-gap'];
// A popover's height within `room`, scrolling within when taller.
const within=(room: number,scroll: boolean): CSSProperties=>({maxHeight:room,overflowY:scroll?'auto':'visible',visibility:room>=POPOVER_MIN_HEIGHT?'visible':'hidden'});
// A placed popover's style: its position and the custom properties it carries from its anchor.
export type PopoverStyle=CSSProperties&{[custom: `--${string}`]: string};

// The style that places an open popover (`panel`) beside its `anchor` (both refs):
// beside it horizontally when `beside` and room allows; otherwise below it,
// or above it when `above`, unless the other side has more room for a
// popover too tall for the preferred one. It never passes the viewport's edges,
// scrolls within when taller than the room, starts at the anchor's left edge or
// centres on it (`align`), and follows scrolling and resizing.
// `avoid` optionally supplies occupied elements/ranges and a boundary outside
// which to fall back when no clear space remains beside the anchor.
// While its own content changes size (a disclosure or a tab inside it), it holds its top edge, so
// the control that changed it stays under the pointer: it grows downward, over its
// anchor when it opened above it, to the viewport's bottom edge, then scrolls
// within. The anchor's width is `--anchor-width`, for a popover at least as wide as
// its anchor.
// Where a popover goes: aligned or centred, preferring above or beside, and what to keep clear of.
export interface PopoverPlacement {
 align?: 'start'|'center';
 above?: boolean;
 beside?: boolean;
 preferBefore?: boolean;
 avoid?: ()=>{elements?: readonly (Element|Range)[],boundary?: Element|null}|null|undefined;
 scroll?: boolean;
}
export function useAnchoredPopover(open: boolean,anchor: RefObject<HTMLElement|null>,panel: RefObject<HTMLElement|null>,{align='start',above=false,beside=false,preferBefore=false,avoid,scroll=true}: PopoverPlacement={}) {
 const [position,setPosition]=useState<PopoverStyle>({left:0,top:0});
 useLayoutEffect(()=>{
  if(!open)return;
  // The content's height and the panel's top edge (from its anchor's) as last placed beside it.
  let placed={height:0,offset:0};
  const anchorNode=anchor.current,panelNode=panel.current;
  if(!anchorNode||!panelNode)return;
  const place=()=>{
   const theme=getComputedStyle(anchorNode),inherited: Record<`--${string}`,string>=Object.fromEntries(ANCHOR_STYLE.map(key=>[key,theme.getPropertyValue(key)]));
   for(const [key,value] of Object.entries(inherited))panelNode.style.setProperty(key,value);
   // Everything in the panel's CSS pixels, which a zoomed page scales on screen.
   const a=cssRect(panelNode,anchorNode),p=cssRect(panelNode),style=getComputedStyle(panelNode),view=cssViewport(panelNode);
   const height=panelNode.scrollHeight+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
   let left=Math.max(VIEWPORT_EDGE,Math.min(align==='center'?a.left+(a.width-p.width)/2:a.left,view.width-p.width-VIEWPORT_EDGE));
   const {elements=[],boundary}=avoid?.()||{},fallback=boundary?cssRect(panelNode,boundary):a;
   const obstacles=elements.map(node=>cssRect(panelNode,node)).filter(box=>box.width>0&&box.height>0);
   const across=obstacles.filter(box=>box.left<left+p.width&&box.right>left);
   const bottom=Math.max(fallback.bottom,...across.map(box=>box.bottom)),start=Math.min(fallback.top,...across.map(box=>box.top));
   const below=Math.max(0,view.height-VIEWPORT_EDGE-bottom-POPOVER_GAP),over=Math.max(0,start-POPOVER_GAP-VIEWPORT_EDGE);
   const [preferred,other]=above?[over,below]:[below,over],onPreferred=height<=preferred||(height>other&&preferred>=other);
   const down=above!==onPreferred;
   let available=down?below:over,top=down?bottom+POPOVER_GAP:start-POPOVER_GAP-Math.min(height,available);
   const before=a.left-POPOVER_GAP-VIEWPORT_EDGE,after=view.width-VIEWPORT_EDGE-a.right-POPOVER_GAP;
   // A compact edge toolbar may sit inside the usual popover inset. Keep its
   // smaller side controls centered without pushing them beyond the viewport.
   const topInset=Math.min(VIEWPORT_EDGE,Math.max(0,a.top)),bottomInset=Math.min(VIEWPORT_EDGE,Math.max(0,view.height-a.bottom));
   const besideTop=Math.max(topInset,Math.min(a.top+(a.height-height)/2,view.height-bottomInset-height));
   const clear=(left: number)=>!obstacles.some(box=>box.left<left+p.width&&box.right>left&&box.top<besideTop+height&&box.bottom>besideTop);
   const beforeLeft=a.left-POPOVER_GAP-p.width,afterLeft=a.right+POPOVER_GAP;
   const fitsBefore=before>=p.width&&clear(beforeLeft),fitsAfter=after>=p.width&&clear(afterLeft);
   if(beside&&(fitsBefore||fitsAfter)){
    left=fitsBefore&&(preferBefore||!fitsAfter||before>after)?beforeLeft:afterLeft;
    available=view.height-VIEWPORT_EDGE*2;
    top=besideTop;
   }
   placed={height:panelNode.scrollHeight,offset:top-a.top};
   setPosition({...inherited,'--anchor-width':`${a.width}px`,
    left,
    top,...within(available,scroll)});
  };
  const hold=()=>{
   if(panelNode.scrollHeight===placed.height)return;
   const top=cssRect(panelNode,anchorNode).top+placed.offset;
   placed={...placed,height:panelNode.scrollHeight};
   setPosition(position=>({...position,top,...within(Math.max(0,cssViewport(panelNode).height-VIEWPORT_EDGE-top),scroll)}));
  };
  // Scrolling within the panel leaves it where it is.
  const follow=(e: Event)=>{if(!(e.target instanceof Node&&panelNode.contains(e.target)))place();};
  place();window.addEventListener('scroll',follow,true);window.addEventListener('resize',place);
  const observer=new ResizeObserver(hold);observer.observe(panelNode);
  return()=>{observer.disconnect();window.removeEventListener('scroll',follow,true);window.removeEventListener('resize',place);};
 },[open,align,above,beside,preferBefore,avoid,scroll]);
 return position;
}
