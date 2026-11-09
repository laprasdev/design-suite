export const LABEL_PEEK_MS=2000;
import {element} from './elementContract.ts';
import {cssRect} from './cssZoom.ts';
// Current released spring behavior, used by every application consumer.
export const SPRING_MS=620;
export const SEGMENT_MOTION=Object.freeze({bounded:true,duration:340});
export const TEXT_SWEEP_MOTION=Object.freeze({duration:200,easing:'ease-in-out'});
// Reference travel: one normal icon step (32px control + 8px gap), in logical CSS pixels.
const TEXT_SWEEP_REFERENCE_PX=40;
export const TextSweepElement=element('bd-text-selection');
export const TEXT_SELECTION_MOVING_ATTRIBUTE='data-text-moving';
export const TEXT_SELECTION_PROPERTIES=Object.freeze({LEFT:'--bd-text-selection-left',RIGHT:'--bd-text-selection-right',OFFSET:'--bd-text-selection-offset'});
// Move the selected-color window through the glyphs. Both edges travel together,
// resizing to the new label; there is no separate light or background indicator.
export function sweepText(root: HTMLElement,labels: HTMLElement[],from: number,to: number) {
 if(reducedMotion())return null;
 const origin=cssRect(root).left+root.clientLeft-root.scrollLeft;
 const boxes=labels.map(label=>{const box=cssRect(root,label);return {left:box.left-origin,right:box.right-origin};});
 labels.forEach((label,index)=>label.style.setProperty(TEXT_SELECTION_PROPERTIES.OFFSET,`${boxes[index].left}px`));
 root.setAttribute(TEXT_SELECTION_MOVING_ATTRIBUTE,'true');
 const frame=({left,right}: {left: number,right: number})=>({[TEXT_SELECTION_PROPERTIES.LEFT]:`${left}px`,[TEXT_SELECTION_PROPERTIES.RIGHT]:`${right}px`});
 const distance=Math.max(
  Math.abs(boxes[to].left-boxes[from].left),Math.abs(boxes[to].right-boxes[from].right));
 // Longer travel takes longer; square-root scaling keeps wide controls responsive.
 const duration=TEXT_SWEEP_MOTION.duration*Math.sqrt(distance/TEXT_SWEEP_REFERENCE_PX);
 const animation=root.animate([frame(boxes[from]),frame(boxes[to])],{...TEXT_SWEEP_MOTION,duration,fill:'both'});
 const clear=()=>root.removeAttribute(TEXT_SELECTION_MOVING_ATTRIBUTE);
 animation.onfinish=()=>{clear();animation.cancel();};animation.oncancel=clear;
 return animation;
}
const SPRING_SAMPLES=40;
const BOUNDED_DECAY=9;
const SPRING_DECAY=7;
const SPRING_FREQUENCY=11;
// A spring's frame at a progress (and the elapsed share of its duration), and its
// animation options: a duration in milliseconds, and `bounded` springs settle
// without overshoot.
export type SpringFrame=(progress: number,t: number)=>Keyframe;
export type SpringOptions=Omit<KeyframeAnimationOptions,'duration'>&{duration?: number,bounded?: boolean};
// How far a switch's views travel, and in what unit.
export interface MotionTravel {
 readonly distance: number;
 readonly unit: string;
}
export const REDUCED_MOTION_QUERY='(prefers-reduced-motion: reduce)';
export const reducedMotion=()=>typeof window!=='undefined'&&window.matchMedia(REDUCED_MOTION_QUERY).matches;
function springProgress(t: number,bounded: boolean) {
 if(bounded)return 1-(1+BOUNDED_DECAY*t)*Math.exp(-BOUNDED_DECAY*t);
 const oscillation=Math.cos(SPRING_FREQUENCY*t)+SPRING_DECAY/SPRING_FREQUENCY*Math.sin(SPRING_FREQUENCY*t);
 return 1-Math.exp(-SPRING_DECAY*t)*oscillation;
}
export function springFrames(frame: SpringFrame,{bounded=false}: {bounded?: boolean}={}) {
 return Array.from({length:SPRING_SAMPLES+1},(_,i)=>{
  const t=i/SPRING_SAMPLES,progress=i===SPRING_SAMPLES?1:springProgress(t,bounded);
  return {...frame(progress,t),offset:t};
 });
}
export function springAnimate(node: Element|null,frame: SpringFrame,{bounded=false,...options}: SpringOptions={}) {
 if(!node||reducedMotion())return null;
 return node.animate(springFrames(frame,{bounded}),{duration:SPRING_MS,easing:'linear',...options});
}
// Scroll on the same spring without transforming the content (which would
// enlarge its scrollable bounds). User input can cancel through the returned function.
export function springScroll(node: HTMLElement,left: number,onFinish: ()=>void) {
 const from=node.scrollLeft;
 if(reducedMotion()||from===left){node.scrollLeft=left;onFinish();return null;}
 const start=performance.now();let frame: number;
 const tick=(now: number)=>{
  const t=Math.min(1,(now-start)/SPRING_MS);
  node.scrollLeft=from+(left-from)*(t===1?1:springProgress(t,true));
  if(t<1)frame=requestAnimationFrame(tick);else onFinish();
 };
 frame=requestAnimationFrame(tick);
 return()=>cancelAnimationFrame(frame);
}


export const EXTENSION_MOTION=Object.freeze({duration:340,easing:'cubic-bezier(.16,1,.3,1)'});
export const MotionSwitchElement=Object.freeze({SWITCH:element('ui-motion-switch'),LIVE:element('ui-motion-live'),OUT:element('ui-motion-out')});
export const MOTION_SWITCHING_ATTRIBUTE='data-motion-switching';
export const SWITCH_TRAVEL=Object.freeze({x:Object.freeze({distance:24,unit:'px'}),y:Object.freeze({distance:32,unit:'px'})});
export const VIEW_SLIDE=Object.freeze({distance:100,unit:'%'});
export const FADE_SWITCH=Object.freeze({distance:0,unit:'px'});
export const PAGE_MOTION=Object.freeze({duration:460,easing:'cubic-bezier(.22,.68,.22,1)',fill:'both'});

export const SCORE_ROLL=VIEW_SLIDE;
export const FILL_FADE_MS=600;
