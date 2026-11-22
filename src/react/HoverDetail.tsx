import {Modal} from './Modal.tsx';
import {ModalPlacement} from './modalElements.ts';
import { useEffect, useId, useRef, useState, type AriaRole, type FocusEvent,
  type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type {PendingButtonAttributes,PendingPress} from './pending.tsx';
import type { PopoverPlacement } from './useAnchoredPopover.ts';

// A term or control with detail on hover, focus or a tap (or, `interactive`, a
// click-opened panel): its content and accessible label, how it opens and where
// its panel sits, the trigger's own attributes, and (`interactive`) its press.
export interface HoverDetailProps {
  children: ReactNode;
  triggerRef?: (node: HTMLButtonElement|null)=>void;
  content: ReactNode;
  label?: string;
  className?: string;
  interactive?: boolean;
  panelClassName?: string;
  press?: PendingPress<MouseEvent<HTMLButtonElement>>;
  disabled?: boolean;
  exclusiveGroup?: string;
  align?: PopoverPlacement['align'];
  above?: boolean;
  beside?: boolean;
  openOnHover?: boolean;
  panelRole?: AriaRole;
  triggerProps?: PendingButtonAttributes&{[attribute: `data-${string}`]: unknown};
}

export function HoverDetail({triggerRef,children,content,label,className='',interactive=false,panelClassName='',press,disabled=false,exclusiveGroup,align='start',above=false,beside=false,openOnHover=true,panelRole=interactive?'dialog':'tooltip',triggerProps={}}: HoverDetailProps) {
  const id=useId(),dragging=useRef(false),tapped=useRef(false);
  const anchor=useRef<HTMLElement|null>(null),panel=useRef<HTMLDivElement|null>(null),[open,setOpen]=useState(false);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const focusable='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]';
  const show=()=>{if(dragging.current)return;clearTimeout(closeTimer.current);setOpen(true);};
  const leave=()=>{clearTimeout(closeTimer.current);closeTimer.current=setTimeout(()=>{if(!anchor.current?.contains(document.activeElement)&&!panel.current?.contains(document.activeElement))setOpen(false);},180);};
  const within=(node: unknown)=>node instanceof Node&&(!!anchor.current?.contains(node)||!!panel.current?.contains(node));
  const blur=(e: FocusEvent)=>{if(!within(e.relatedTarget))setOpen(false);};
  useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
  // A trigger that becomes unavailable closes its open detail.
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  // A drag keeps details from opening while it lasts; its Modal dismisses one that is open.
  useEffect(()=>{
    const start=()=>{dragging.current=true;clearTimeout(closeTimer.current);},end=()=>{dragging.current=false;};
    const listeners=[['dragstart',start],['dragend',end],['drop',end]] as const;
    for(const [type,listener] of listeners)document.addEventListener(type,listener,true);
    return()=>{for(const [type,listener] of listeners)document.removeEventListener(type,listener,true);};
  },[]);
  // The trigger's press closes its detail unless refused (a pending one's, pending.tsx); with no press, a click
  // shows its detail, or toggles a click one. Hover details follow the pointer; click details stay open until their
  // anchored Modal dismisses them. A click focuses the trigger, which not every browser does, so Escape reaches it.
  // A described term (not `interactive`) opens under the mouse or focus, and a tap (touch or
  // pen) toggles it, even inside a disabled control. Its clicks and taps stop at the term, so a
  // term within a control never activates the control, and its empty title keeps the control's
  // own title from covering its detail.
  const hoverLeave=openOnHover?leave:undefined,toggle=()=>open?setOpen(false):show();
  const triggerKey=(e: KeyboardEvent)=>{if(e.key==='Tab'&&!e.shiftKey&&open){const first=panel.current?.querySelector<HTMLElement>(focusable);if(first){e.preventDefault();first.focus();}}};
  const panelKey=(e: KeyboardEvent)=>{
    const box=panel.current,trigger=anchor.current;
    if(e.key!=='Tab'||!box||!trigger)return;
    const items=[...box.querySelectorAll<HTMLElement>(focusable)];
    if(e.shiftKey&&e.target===items[0]){e.preventDefault();trigger.focus();return;}
    if(e.shiftKey||e.target!==items.at(-1))return;
    const page=[...document.querySelectorAll<HTMLElement>(focusable)]
      .filter(item=>!box.contains(item)&&!item.closest('[inert]')&&item.getClientRects().length);
    const next=page[page.indexOf(trigger)+1];
    if(next){e.preventDefault();next.focus();}
    setOpen(false);
  };
  const anchorRef=(node: HTMLElement|null)=>{anchor.current=node;if(node instanceof HTMLButtonElement||node===null)triggerRef?.(node);};
  return <>{interactive?<button type="button" {...triggerProps} aria-busy={press?.['aria-busy']} ref={anchorRef} disabled={disabled} className={`gp-hover-anchor ${className}`} data-open-on={openOnHover?'hover':'click'} aria-label={label} aria-haspopup={panelRole==='dialog'?'dialog':undefined} aria-expanded={panelRole==='dialog'?open:undefined} aria-controls={panelRole==='dialog'&&open?id:undefined} aria-describedby={panelRole==='tooltip'&&open?id:undefined} onMouseEnter={openOnHover?show:undefined} onMouseLeave={hoverLeave} onFocus={openOnHover?show:undefined} onBlur={blur} onKeyDown={triggerKey} onClick={e=>{e.currentTarget.focus();if(press?.onClick){press.onClick(e);if(!e.defaultPrevented)setOpen(false);}else if(openOnHover)show();else toggle();}}>{children}</button>:<span ref={anchorRef} tabIndex={0} title="" className={`gp-hover-anchor ${className}`} data-open-on={openOnHover?'hover':'click'} aria-label={label} aria-describedby={open?id:undefined} onPointerEnter={openOnHover?e=>{if(e.pointerType==='mouse')show();}:undefined} onPointerLeave={openOnHover?e=>{if(e.pointerType==='mouse')setOpen(false);}:undefined} onPointerDown={e=>{tapped.current=e.pointerType!=='mouse';}} onPointerUp={()=>{if(tapped.current&&!dragging.current)setOpen(v=>!v);}} onFocus={openOnHover?show:undefined} onBlur={()=>setOpen(false)} onClick={e=>{e.stopPropagation();if(!tapped.current&&!dragging.current)setOpen(v=>!v);}}>{children}</span>}{open&&<Modal open placement={ModalPlacement.ANCHORED} anchor={anchor} popover={{align,above,beside}} group={exclusiveGroup} onClose={()=>setOpen(false)} id={id} panelRef={panel} role={panelRole} ariaLabel={interactive?label:undefined} className={`gp-hover-detail ${panelClassName}`} onMouseEnter={interactive&&openOnHover?show:undefined} onMouseLeave={interactive?hoverLeave:undefined} onFocus={interactive?show:undefined} onBlur={interactive?blur:undefined} onKeyDown={interactive?panelKey:undefined}>{content}</Modal>}</>;
}
