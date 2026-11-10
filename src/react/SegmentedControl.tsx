/* Reusable segmented control. `options` is [{ value, label, detail?, disabled?, title? }]; an option disabled on its
   own is grayed out (its detail still opens), while a disabled control keeps its look. Neither changes a value when
   pressed, with or without `onPoint`, which keeps its options pointable. `multiple` takes and returns an array, each
   option toggled independently. The kit Label (action kind) draws its text, one typographic source with Button and
   the rest. `fit` fills the available width: true uses equal segments; "content" gives longer labels more room.
   Without it the control ends where its options do. `scroll` keeps a wider row of options within the parent's
   width: they scroll inside the control's own frame, and the selected one stays in view.
   `density="compact"` uses caption text and tighter spacing.
   A multiple choice draws as joined cells, each filling its cell when chosen. A single choice saving: `pending`. */
import {useContext,useLayoutEffect,useRef,type CSSProperties,type KeyboardEvent,type ReactElement,type ReactNode} from 'react';
import {springAnimate,SegmentIndicator,SEGMENT_MOTION,sweepText,TextSweepElement,TEXT_SELECTION_MOVING_ATTRIBUTE} from './motion.ts';
import {Label} from './accents.tsx';
import {SegmentDefaultsContext} from './segmentContext.ts';
import {wrapVariables,type WrapGrid,type Pictured} from './segmentWrap.ts';
import {HoverDetail} from './HoverDetail.tsx';
import {PALETTE_CHANGE_EVENT} from '../theme.ts';
import {cssRect} from './cssZoom.ts';
import {pendingText,type SegmentPending} from './segmentPending.tsx';

// An option: its value and label, hover help (`detail`) or a chosen description,
// whether it is unavailable, and its own attributes.
export type SegmentValue=string|number|boolean;
export const TEXT_SEGMENT_VARIANT='text';
export const JOINED_SEGMENT_VARIANT='joined';
export const ICON_SEGMENT_VARIANT='icons';
export const SEGMENT_GROUP_START_ATTRIBUTE='data-group-start';
export interface SegmentOption<V extends SegmentValue> {
  value: V;
  buttonRef?: (node: HTMLButtonElement|null)=>void;
  label: ReactNode;
  detail?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
  controls?: string;
  expanded?: boolean;
  ariaLabel?: string;
  mixed?: boolean;
  // Options sharing a group sit together, with a wider space before the next.
  group?: string;
  // The option's own data attributes, for a consumer that reads its options back from the page.
  data?: Readonly<Record<`data-${string}`,string|number|boolean|undefined>>;
}
interface SegmentedBase<V extends SegmentValue> extends Pictured<V> {
  options: readonly SegmentOption<V>[];
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  variant?: string;
  density?: string;
  tabs?: boolean;
  orientation?: 'horizontal'|'vertical';
  /** A vertical rail floating in its space: a rule above its first row and below its last. */
  closed?: boolean;
  /** Square cells, sized in pixels or by a CSS token, with no padding. */
  cell?: number | `var(--${string})`;
  wrap?: WrapGrid;
  iconOnly?: boolean;
  fit?: boolean|'content';
  scroll?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}
// One choice, or (`multiple`) any set of them.
// The options give the values; a change handler takes them (and never decides them).
export type SingleSegmentProps<V extends SegmentValue>=SegmentedBase<V>&{multiple?: false,value?: V|null,pending?: SegmentPending<NoInfer<V>>|null,onChange(value: NoInfer<V>): void};
export type MultipleSegmentProps<V extends SegmentValue>=SegmentedBase<V>&{multiple: true,value: readonly V[],pending?: never,onChange(value: NoInfer<V>[]): void};
export type SegmentedControlProps<V extends SegmentValue>=SingleSegmentProps<V>|MultipleSegmentProps<V>;
// The indicator's last place, colour and value.
interface IndicatorBox {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  radius: string;
  token?: string;
  value?: unknown;
  travels?: boolean;
}
const placed=(box: {w: number,h: number})=>box.w>0&&box.h>0;
// Each form infers its values from its own options and change handler.
export function SegmentedControl<V extends SegmentValue>(props: SingleSegmentProps<V>): ReactElement;
export function SegmentedControl<V extends SegmentValue>(props: MultipleSegmentProps<V>): ReactElement;
export function SegmentedControl<V extends SegmentValue>(props: SegmentedControlProps<V>) {
  const surface=useContext(SegmentDefaultsContext);
  const { options, value: given, ariaLabel, className='', style, variant=surface.variant, density=surface.density, tabs=surface.tabs??false, orientation='horizontal', closed=false, cell, glyphShare, wrap, onPoint, iconOnly=false, multiple=false, fit=false, scroll=surface.scroll??false, disabled=false, children }=props,pending=props.multiple?undefined:props.pending??undefined,value=pending?pending.value:given;
  const swept=variant===TEXT_SEGMENT_VARIANT||variant===ICON_SEGMENT_VARIANT;
  const filled=!multiple&&!swept;
  const own=useRef<HTMLDivElement|null>(null),root=wrap?.frame??own,indicator=useRef<HTMLSpanElement|null>(null),previous=useRef<IndicatorBox|null>(null),animation=useRef<Animation|null>(null);
  const lastText=useRef({value,ariaLabel}),textAnimation=useRef<Animation|null>(null);
  const chosen=(option: V)=>props.multiple?props.value.includes(option):value===option;
  const choose=(option: V,selected: boolean)=>{
    if(pending||disabled||options.some(o=>o.value===option&&o.disabled))return;
    if(props.multiple)props.onChange(selected?props.value.filter(v=>v!==option):[...props.value,option]);
    else props.onChange(option);
  };
  // A scrolling control reveals its selection (a saved choice, or after a resize) by
  // scrolling its own frame, never the page or its footer.
  useLayoutEffect(()=>{
    const node=root.current;
    if(!scroll||!node)return;
    const selected=node.querySelector('button[data-on="true"]');
    if(!selected)return;
    const reveal=()=>{
      const frame=cssRect(node),option=cssRect(node,selected),vertical=orientation==='vertical';
      const start=vertical?frame.top+node.clientTop:frame.left+node.clientLeft,end=start+(vertical?node.clientHeight:node.clientWidth);
      const low=vertical?option.top:option.left,high=vertical?option.bottom:option.right;
      const delta=low<start?low-start:high>end?high-end:0;
      if(vertical)node.scrollTop+=delta;else node.scrollLeft+=delta;
    };
    const observer=new ResizeObserver(reveal);observer.observe(node);
    node.querySelectorAll("button").forEach(option=>observer.observe(option,{box:'border-box'}));reveal();
    return()=>observer.disconnect();
  },[scroll,value,orientation]);
  useLayoutEffect(()=>{
    const last=lastText.current;lastText.current={value,ariaLabel};
    if(!swept||multiple||last.ariaLabel!==ariaLabel||last.value===value)return;
    const node=root.current,from=options.findIndex(option=>option.value===last.value),to=options.findIndex(option=>option.value===value);
    if(!node||from<0||to<0)return;
    if(textAnimation.current){textAnimation.current.oncancel=null;textAnimation.current.cancel();}
    textAnimation.current=sweepText(node,[...node.querySelectorAll<HTMLElement>(TextSweepElement.selector)],from,to);
    return()=>{if(textAnimation.current){textAnimation.current.oncancel=null;textAnimation.current.cancel();}node.removeAttribute(TEXT_SELECTION_MOVING_ATTRIBUTE);};
  },[value,ariaLabel,swept,multiple]);
  // Read the inherited color after every commit: a team or palette can change
  // while the selected option and its geometry stay the same.
  useLayoutEffect(()=>{
    if(!filled)return;
    const update=()=>{
      const frame=root.current,selected=frame?.querySelector<HTMLElement>('button[data-on="true"]'),node=indicator.current;
      if(!frame||!node)return;
      node.hidden=!selected;
      if(!selected){animation.current?.cancel();previous.current=null;return;}
      const computed=getComputedStyle(selected),frameStyle=getComputedStyle(frame),option=cssRect(frame,selected),origin=cssRect(frame);
      if(!option.width||!option.height){node.hidden=true;animation.current?.cancel();previous.current=null;return;}
      // The frame owns border-box sizing. Remove an ancestor's entrance scale as well
      // as CSS zoom, keeping fractional option bounds in the frame's layout coordinates.
      const scaleX=origin.width/parseFloat(frameStyle.width),scaleY=origin.height/parseFloat(frameStyle.height);
      const box: IndicatorBox={
        x:(option.left-origin.left)/scaleX-parseFloat(frameStyle.borderLeftWidth)+frame.scrollLeft,
        y:(option.top-origin.top)/scaleY-parseFloat(frameStyle.borderTopWidth)+frame.scrollTop,
        w:option.width/scaleX,h:option.height/scaleY,color:computed.getPropertyValue('--segment-fill').trim()||computed.backgroundColor,radius:computed.borderRadius,
      };
      box.token=box.color;
      const current=previous.current;
      if(current&&current.x===box.x&&current.y===box.y&&current.w===box.w&&current.h===box.h&&current.value===value&&current.token===box.token)return;
      // The indicator travels between laid-out options for a selection change, or to finish
      // a travel still in flight. A layout change while it rests (mounting, a hidden panel
      // opening, fonts or images settling, a resize) places it without motion.
      const inFlight=current?.travels&&animation.current?.playState==='running';
      const travels=!!current&&placed(current)&&placed(box)&&(current.value!==value||inFlight);
      const recolors=!!current&&placed(box)&&current.token!==box.token;
      // The indicator's place in the options' coordinates, which a scrolled frame offsets.
      const actual=cssRect(frame,node);
      const from={...(travels?{
        x:(actual.left-origin.left)/scaleX-parseFloat(frameStyle.borderLeftWidth)+frame.scrollLeft,
        y:(actual.top-origin.top)/scaleY-parseFloat(frameStyle.borderTopWidth)+frame.scrollTop,
        w:actual.width/scaleX,h:actual.height/scaleY,
      }:box),color:getComputedStyle(node).backgroundColor};
      animation.current?.cancel();Object.assign(node.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.w}px`,height:`${box.h}px`,borderRadius:box.radius,background:box.color});
      // Resolve custom-property colors before animating between teams.
      box.color=getComputedStyle(node).backgroundColor;
      if(travels||recolors){animation.current=springAnimate(node,(p: number)=>({transform:`translate(${(from.x-box.x)*(1-p)}px,${(from.y-box.y)*(1-p)}px) scale(${(from.w+(box.w-from.w)*p)/box.w},${(from.h+(box.h-from.h)*p)/box.h})`,backgroundColor:`color-mix(in srgb, ${from.color} ${100*(1-Math.max(0,Math.min(1,p)))}%, ${box.color})`}),SEGMENT_MOTION);}
      previous.current={...box,value,travels};
    };
    const frame=root.current;if(!frame)return;
    update();const observer=new ResizeObserver(update);observer.observe(frame);
    frame.querySelectorAll("button").forEach(option=>observer.observe(option,{box:'border-box'}));
    window.addEventListener(PALETTE_CHANGE_EVENT,update);
    return()=>{observer.disconnect();window.removeEventListener(PALETTE_CHANGE_EVENT,update);};
  });
  const onKeyDown=(e: KeyboardEvent<HTMLDivElement>)=>{
    const back=orientation==='vertical'?'ArrowUp':'ArrowLeft',next=orientation==='vertical'?'ArrowDown':'ArrowRight';
    if(!tabs||disabled||pending||![back,next,'Home','End'].includes(e.key))return;
    const enabled=options.filter(o=>!o.disabled);
    if(!enabled.length)return;
    e.preventDefault();
    const current=enabled.findIndex(o=>o.value===value),index=e.key==='Home'?0:e.key==='End'?enabled.length-1:(current+(e.key===next?1:-1)+enabled.length)%enabled.length;
    choose(enabled[index].value,chosen(enabled[index].value));e.currentTarget.querySelectorAll('button')[options.indexOf(enabled[index])]?.focus();
  };
  return (
    <div ref={root} className={`seg${variant?` seg--${variant}`:''}${className?` ${className}`:''}`} data-fit={fit||undefined} data-scroll={scroll||undefined} data-density={density} style={{...(fit&&{'--segment-count':options.length}),...(cell!==undefined&&{'--segment-cell':typeof cell==='number'?`${cell}px`:cell}),...(glyphShare!==undefined&&{'--segment-glyph-share':glyphShare}),...(wrap&&wrapVariables(wrap,options.length)),...style}} data-cell={cell!==undefined||undefined} data-glyph={glyphShare!==undefined||undefined} data-wrap={wrap?true:undefined} data-count={options.length} data-orientation={orientation} data-closed={closed||undefined} data-icon-only={iconOnly||undefined} data-multiple={multiple||undefined} data-pending={pending?true:undefined} role={tabs?'tablist':'group'} aria-orientation={tabs?orientation:undefined} aria-label={ariaLabel} aria-busy={pending?true:undefined} onKeyDown={onKeyDown}>
      {filled&&<span ref={indicator} className={SegmentIndicator.className} aria-hidden="true"/>}
      {options.map((o,index) => {
        const selected=chosen(o.value),saving=pending?.value===o.value;
        const optionProps={...o.data,className:o.className,style:o.style,id:o.id,title:o.title,role:tabs?'tab':undefined,'aria-selected':tabs?selected:undefined,'aria-pressed':tabs?undefined:multiple&&o.mixed?'mixed' as const:selected,'aria-controls':o.controls,'aria-expanded':o.expanded,tabIndex:tabs?(selected?0:-1):undefined,onMouseEnter:()=>onPoint?.(o.value),onMouseLeave:()=>onPoint?.(null),onFocus:()=>onPoint?.(o.value),onBlur:()=>onPoint?.(null),'data-on':selected,'data-mixed':multiple&&o.mixed||undefined,'data-unavailable':o.disabled||undefined,'data-pending':saving||undefined,[SEGMENT_GROUP_START_ATTRIBUTE]:index>0&&o.group!==options[index-1].group||undefined};
        const label=<Label kind="action">{saving?<span className="seg-pending" role="status">{pendingText(o,pending)}</span>:o.label}{swept&&<span className={TextSweepElement.className} aria-hidden="true">{pendingText(o,pending)}</span>}</Label>,select=()=>choose(o.value,selected);
        // An option's `detail` is hover/focus help, shared with settings through HoverDetail.
        // An option unavailable on its own keeps its help: hovering or pressing it explains why.
        return o.detail
          ?<HoverDetail triggerRef={o.buttonRef} key={String(o.value)} interactive panelRole="tooltip" label={o.ariaLabel??(typeof o.label==='string'?o.label:undefined)} content={o.detail} disabled={disabled} triggerProps={{...optionProps,'aria-disabled':o.disabled||undefined}} onActivate={o.disabled?undefined:select}>{label}</HoverDetail>
          :<button ref={o.buttonRef} type="button" key={String(o.value)} {...optionProps} aria-label={o.ariaLabel} disabled={!onPoint&&(disabled||o.disabled)} aria-disabled={onPoint&&(disabled||o.disabled)||undefined} onClick={select}>{label}</button>;
      })}
      {children}
    </div>
  );
}
