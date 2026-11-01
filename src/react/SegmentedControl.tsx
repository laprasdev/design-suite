/* Reusable segmented control. `options` is [{ value, label, detail?, disabled?, title? }];
   an option disabled on its own is grayed out (its detail still opens), while a disabled control keeps its look. Composes the
   `multiple` takes and returns an array, with each option toggled independently.
   The kit Label (action kind) for its text, so it shares one typographic source with
   Button and the rest — consistent font/size/spacing everywhere.
   `fit` fills the available width: true uses equal segments; "content" gives
   longer labels more room. Without it the control ends where its options do.
   `scroll` keeps a wider row of options within the parent's width: they scroll inside
   the control's own frame, and the selected one stays in view.
   `density="compact"` uses caption text and tighter spacing.
   A multiple choice draws as joined cells, each filling its cell when chosen. */
import {useContext,useLayoutEffect,useRef,type CSSProperties,type KeyboardEvent,type ReactElement,type ReactNode} from 'react';
import {springAnimate,SEGMENT_MOTION,sweepText,TextSweepElement,TEXT_SELECTION_MOVING_ATTRIBUTE} from './motion.ts';
import {Label} from './accents.tsx';
import {SegmentDefaultsContext} from './segmentContext.ts';
import {HoverDetail} from './HoverDetail.tsx';
import {PALETTE_CHANGE_EVENT} from '../theme.ts';

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
  ariaLabel?: string;
  mixed?: boolean;
  // Options sharing a group sit together, with a wider space before the next.
  group?: string;
}
interface SegmentedBase<V extends SegmentValue> {
  options: readonly SegmentOption<V>[];
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  variant?: string;
  density?: string;
  tabs?: boolean;
  orientation?: 'horizontal'|'vertical';
  iconOnly?: boolean;
  fit?: boolean|'content';
  scroll?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}
// One choice, or (`multiple`) any set of them.
// The options give the values; a change handler takes them (and never decides them).
export type SingleSegmentProps<V extends SegmentValue>=SegmentedBase<V>&{multiple?: false,value?: V|null,onChange(value: NoInfer<V>): void};
export type MultipleSegmentProps<V extends SegmentValue>=SegmentedBase<V>&{multiple: true,value: readonly V[],onChange(value: NoInfer<V>[]): void};
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
  const { options, value, ariaLabel, className='', style, variant=surface.variant, density=surface.density, tabs=surface.tabs??false, orientation='horizontal', iconOnly=false, multiple=false, fit=false, scroll=surface.scroll??false, disabled=false, children }=props;
  const swept=variant===TEXT_SEGMENT_VARIANT||variant===ICON_SEGMENT_VARIANT;
  const filled=!multiple&&!swept;
  const root=useRef<HTMLDivElement|null>(null),indicator=useRef<HTMLSpanElement|null>(null),previous=useRef<IndicatorBox|null>(null),animation=useRef<Animation|null>(null);
  const lastText=useRef({value,ariaLabel}),textAnimation=useRef<Animation|null>(null);
  const chosen=(option: V)=>props.multiple?props.value.includes(option):props.value===option;
  const choose=(option: V,selected: boolean)=>{
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
      const frame=node.getBoundingClientRect(),option=selected.getBoundingClientRect(),vertical=orientation==='vertical';
      const start=vertical?frame.top+node.clientTop:frame.left+node.clientLeft,end=start+(vertical?node.clientHeight:node.clientWidth);
      const low=vertical?option.top:option.left,high=vertical?option.bottom:option.right;
      const delta=low<start?low-start:high>end?high-end:0;
      if(vertical)node.scrollTop+=delta;else node.scrollLeft+=delta;
    };
    const observer=new ResizeObserver(reveal);observer.observe(node);observer.observe(selected);reveal();
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
      const frame=root.current,selected=frame?.querySelector<HTMLElement>('button[data-on="true"]'),node=indicator.current;if(!frame||!selected||!node)return;
      const computed=getComputedStyle(selected),box: IndicatorBox={x:selected.offsetLeft,y:selected.offsetTop,w:selected.offsetWidth,h:selected.offsetHeight,color:computed.getPropertyValue('--segment-fill').trim()||computed.backgroundColor,radius:computed.borderRadius};
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
      const actual=node.getBoundingClientRect(),origin=frame.getBoundingClientRect();
      const from={...(travels?{x:actual.left-origin.left-frame.clientLeft+frame.scrollLeft,y:actual.top-origin.top-frame.clientTop+frame.scrollTop,w:actual.width,h:actual.height}:box),color:getComputedStyle(node).backgroundColor};
      animation.current?.cancel();Object.assign(node.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.w}px`,height:`${box.h}px`,borderRadius:box.radius,background:box.color});
      // Resolve custom-property colors before animating between teams.
      box.color=getComputedStyle(node).backgroundColor;
      if(travels||recolors){animation.current=springAnimate(node,(p: number)=>({transform:`translate(${(from.x-box.x)*(1-p)}px,${(from.y-box.y)*(1-p)}px) scale(${(from.w+(box.w-from.w)*p)/box.w},${(from.h+(box.h-from.h)*p)/box.h})`,backgroundColor:`color-mix(in srgb, ${from.color} ${100*(1-Math.max(0,Math.min(1,p)))}%, ${box.color})`}),SEGMENT_MOTION);}
      previous.current={...box,value,travels};
    };
    const frame=root.current;if(!frame)return;
    update();const observer=new ResizeObserver(update);observer.observe(frame);window.addEventListener(PALETTE_CHANGE_EVENT,update);return()=>{observer.disconnect();window.removeEventListener(PALETTE_CHANGE_EVENT,update);};
  });
  const onKeyDown=(e: KeyboardEvent<HTMLDivElement>)=>{
    const previous=orientation==='vertical'?'ArrowUp':'ArrowLeft',next=orientation==='vertical'?'ArrowDown':'ArrowRight';
    if(!tabs||disabled||![previous,next,'Home','End'].includes(e.key))return;
    const enabled=options.filter(o=>!o.disabled);
    if(!enabled.length)return;
    e.preventDefault();
    const current=enabled.findIndex(o=>o.value===value),index=e.key==='Home'?0:e.key==='End'?enabled.length-1:(current+(e.key===next?1:-1)+enabled.length)%enabled.length;
    choose(enabled[index].value,chosen(enabled[index].value));e.currentTarget.querySelectorAll('button')[options.indexOf(enabled[index])]?.focus();
  };
  return (
    <div ref={root} className={`seg${variant?` seg--${variant}`:''}${className?` ${className}`:''}`} data-fit={fit||undefined} data-scroll={scroll||undefined} data-density={density} style={fit?{'--segment-count':options.length,...style}:style} data-count={options.length} data-orientation={orientation} data-icon-only={iconOnly||undefined} data-multiple={multiple||undefined} role={tabs?'tablist':'group'} aria-orientation={tabs?orientation:undefined} aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {filled&&<span ref={indicator} className="seg-indicator" aria-hidden="true"/>}
      {options.map((o,index) => {
        const selected=chosen(o.value);
        const optionProps={className:o.className,style:o.style,id:o.id,title:o.title,role:tabs?'tab':undefined,'aria-selected':tabs?selected:undefined,'aria-pressed':tabs?undefined:multiple&&o.mixed?'mixed' as const:selected,'aria-controls':o.controls,tabIndex:tabs?(selected?0:-1):undefined,'data-on':selected,'data-mixed':multiple&&o.mixed||undefined,'data-unavailable':o.disabled||undefined,[SEGMENT_GROUP_START_ATTRIBUTE]:index>0&&o.group!==options[index-1].group||undefined};
        const label=<Label kind="action">{o.label}{swept&&<span className={TextSweepElement.className} aria-hidden="true">{o.label}</span>}</Label>,select=()=>choose(o.value,selected);
        // An option's `detail` is hover/focus help, shared with settings through HoverDetail.
        // An option unavailable on its own keeps its help: hovering or pressing it explains why.
        return o.detail
          ?<HoverDetail triggerRef={o.buttonRef} key={String(o.value)} interactive panelRole="tooltip" label={o.ariaLabel??(typeof o.label==='string'?o.label:undefined)} content={o.detail} disabled={disabled} triggerProps={{...optionProps,'aria-disabled':o.disabled||undefined}} onActivate={o.disabled?undefined:select}>{label}</HoverDetail>
          :<button ref={o.buttonRef} type="button" key={String(o.value)} {...optionProps} aria-label={o.ariaLabel} disabled={disabled||o.disabled} onClick={select}>{label}</button>;
      })}
      {children}
    </div>
  );
}
