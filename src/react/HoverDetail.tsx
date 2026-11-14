import {Modal} from './Modal.tsx';
import {ModalPlacement} from './modalElements.ts';
import {ApplicationElement} from './applicationElements.ts';
import { useEffect, useId, useRef, useState, type AriaRole, type ButtonHTMLAttributes, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPopover, type PopoverPlacement } from './useAnchoredPopover.ts';

// A term or control with detail on hover, focus or a tap (or, `interactive`, a
// click-opened panel): its content and accessible label, how it opens and where
// its panel sits, and the trigger's own attributes.
export interface HoverDetailProps {
  children: ReactNode;
  triggerRef?: (node: HTMLButtonElement|null)=>void;
  content: ReactNode;
  label?: string;
  className?: string;
  interactive?: boolean;
  panelClassName?: string;
  onActivate?: (event: MouseEvent<HTMLButtonElement>)=>void;
  disabled?: boolean;
  exclusiveGroup?: string;
  align?: PopoverPlacement['align'];
  above?: boolean;
  beside?: boolean;
  openOnHover?: boolean;
  panelRole?: AriaRole;
  triggerProps?: ButtonHTMLAttributes<HTMLButtonElement>&{[attribute: `data-${string}`]: unknown};
}

export function HoverDetail({triggerRef,children,content,label,className='',interactive=false,panelClassName='',onActivate,disabled=false,exclusiveGroup,align='start',above=false,beside=false,openOnHover=true,panelRole=interactive?'dialog':'tooltip',triggerProps={}}: HoverDetailProps) {
  const id=useId(),dragging=useRef(false),tapped=useRef(false);
  const anchor=useRef<HTMLElement|null>(null),panel=useRef<HTMLDivElement|null>(null),[open,setOpen]=useState(false),position=useAnchoredPopover(open,anchor,panel,{align,above,beside});
  const closeTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]';
  const show=()=>{if(dragging.current)return;clearTimeout(closeTimer.current);setOpen(true);};
  const leave=()=>{clearTimeout(closeTimer.current);closeTimer.current=setTimeout(()=>{if(!anchor.current?.contains(document.activeElement)&&!panel.current?.contains(document.activeElement))setOpen(false);},180);};
  const within=(node: unknown)=>node instanceof Node&&(!!anchor.current?.contains(node)||!!panel.current?.contains(node));
  const blur=(e: FocusEvent)=>{if(!within(e.relatedTarget))setOpen(false);};
  useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
  // A trigger that becomes unavailable closes its open detail.
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  // A drag keeps details from opening while it lasts; its Modal dismisses one that is open.
  useEffect(()=>{const start=()=>{dragging.current=true;clearTimeout(closeTimer.current);},end=()=>{dragging.current=false;};document.addEventListener('dragstart',start,true);document.addEventListener('dragend',end,true);document.addEventListener('drop',end,true);return()=>{document.removeEventListener('dragstart',start,true);document.removeEventListener('dragend',end,true);document.removeEventListener('drop',end,true);};},[]);
  // Hover details follow the pointer; click details stay open until a press elsewhere or Escape, which its anchored
  // Modal decides from the panel and the trigger, its anchor. A click focuses the trigger, which not every browser
  // does, so its Escape reaches the detail.
  // A described term (not `interactive`) opens under the mouse or focus, and a tap (touch or
  // pen) toggles it, even inside a disabled control. Its clicks and taps stop at the term, so a
  // term within a control never activates the control, and its empty title keeps the control's
  // own title from covering its detail.
  const hoverLeave=openOnHover?leave:undefined,toggle=()=>open?setOpen(false):show();
  const triggerKey=(e: KeyboardEvent)=>{if(e.key==='Tab'&&!e.shiftKey&&open){const first=panel.current?.querySelector<HTMLElement>(focusable);if(first){e.preventDefault();first.focus();}}};
  const panelKey=(e: KeyboardEvent)=>{const box=panel.current,trigger=anchor.current;if(e.key!=='Tab'||!box||!trigger)return;const items=[...box.querySelectorAll<HTMLElement>(focusable)];if(e.shiftKey&&e.target===items[0]){e.preventDefault();trigger.focus();}else if(!e.shiftKey&&e.target===items.at(-1)){const items=[...document.querySelectorAll<HTMLElement>(focusable)].filter(item=>!box.contains(item)&&!item.closest('[inert]')&&item.getClientRects().length);const next=items[items.indexOf(trigger)+1];if(next){e.preventDefault();next.focus();}setOpen(false);}};
  const anchorRef=(node: HTMLElement|null)=>{anchor.current=node;if(node instanceof HTMLButtonElement||node===null)triggerRef?.(node);};
  return <>{interactive?<button type="button" {...triggerProps} ref={anchorRef} disabled={disabled} className={`gp-hover-anchor ${className}`} data-open-on={openOnHover?'hover':'click'} aria-label={label} aria-haspopup={panelRole==='dialog'?'dialog':undefined} aria-expanded={panelRole==='dialog'?open:undefined} aria-controls={panelRole==='dialog'&&open?id:undefined} aria-describedby={panelRole==='tooltip'&&open?id:undefined} onMouseEnter={openOnHover?show:undefined} onMouseLeave={hoverLeave} onFocus={openOnHover?show:undefined} onBlur={blur} onKeyDown={triggerKey} onClick={e=>{e.currentTarget.focus();if(onActivate){setOpen(false);onActivate(e);}else if(openOnHover)show();else toggle();}}>{children}</button>:<span ref={anchorRef} tabIndex={0} title="" className={`gp-hover-anchor ${className}`} data-open-on={openOnHover?'hover':'click'} aria-label={label} aria-describedby={open?id:undefined} onPointerEnter={openOnHover?e=>{if(e.pointerType==='mouse')show();}:undefined} onPointerLeave={openOnHover?e=>{if(e.pointerType==='mouse')setOpen(false);}:undefined} onPointerDown={e=>{tapped.current=e.pointerType!=='mouse';}} onPointerUp={()=>{if(tapped.current&&!dragging.current)setOpen(v=>!v);}} onFocus={openOnHover?show:undefined} onBlur={()=>setOpen(false)} onClick={e=>{e.stopPropagation();if(!tapped.current&&!dragging.current)setOpen(v=>!v);}}>{children}</span>}{open&&createPortal(<Modal open placement={ModalPlacement.ANCHORED} anchor={anchor} group={exclusiveGroup} onClose={()=>setOpen(false)} id={id} panelRef={panel} role={panelRole} ariaLabel={interactive?label:undefined} className={`gp-hover-detail ${panelClassName}`} style={position} onMouseEnter={interactive&&openOnHover?show:undefined} onMouseLeave={interactive?hoverLeave:undefined} onFocus={interactive?show:undefined} onBlur={interactive?blur:undefined} onKeyDown={interactive?panelKey:undefined}>{content}</Modal>,anchor.current?.closest(ApplicationElement.ROOT.selector)||document.body)}</>;
}
