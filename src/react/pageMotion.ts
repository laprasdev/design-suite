import {PAGE_MOTION,VIEW_SLIDE} from './motion.ts';
import {cssRect} from './cssZoom.ts';

export type PageDirection=-1|0|1;
export type PageTiming=KeyframeAnimationOptions&{duration: number,delay?: number};
export type PageAnimation=readonly [frames: Keyframe[],timing: PageTiming];
export const PAGE_FADE: PageTiming=Object.freeze({...PAGE_MOTION,duration:PAGE_MOTION.duration/2});
export const PAGE_FADE_OUT: Keyframe[]=[{opacity:1},{opacity:0}];
export const PAGE_FADE_IN: Keyframe[]=[{opacity:0},{opacity:1}];
export const PageMotionElement=Object.freeze({
 OUTGOING:'bd-page-out',CONTENT:'bd-page-content',CHROME:'bd-page-chrome',SCAFFOLD:'bd-page-scaffold',
});

// Direction is supplied by navigation. Zero replaces a page in place.
export function pageFrames(direction: PageDirection): {outgoing: PageAnimation,incoming: PageAnimation} {
 if(!direction)return {
  outgoing:[PAGE_FADE_OUT,PAGE_FADE],
  incoming:[PAGE_FADE_IN,{...PAGE_FADE,delay:PAGE_FADE.duration}],
 };
 return {
  outgoing:[[{transform:'translateX(0)',opacity:1},
   {transform:`translateX(${-direction*VIEW_SLIDE.distance}${VIEW_SLIDE.unit})`,opacity:0}],PAGE_MOTION],
  incoming:[[{transform:`translateX(${direction*VIEW_SLIDE.distance}${VIEW_SLIDE.unit})`,opacity:0},
   {transform:'translateX(0)',opacity:1}],PAGE_MOTION],
 };
}

export type PageScroll=readonly [index: number,top: number,left: number][];
export interface PageCopy {
 copy: HTMLElement;
 height: number;
 scrolled: PageScroll;
}
export function capturePageScroll(root: HTMLElement): PageScroll {
 return [root,...root.querySelectorAll('*')].flatMap((node,index): PageScroll=>
  node.scrollTop||node.scrollLeft?[[index,node.scrollTop,node.scrollLeft]]:[]);
}
export function restorePageScroll(root: HTMLElement,scrolled: PageScroll) {
 const nodes=[root,...root.querySelectorAll('*')];
 for(const [index,top,left] of scrolled) {
  const node=nodes[index];
  if(node)Object.assign(node,{scrollTop:top,scrollLeft:left});
 }
}
// Capture DOM, not React children: leaving a page never mounts effects twice.
export function capturePage(page: HTMLElement): PageCopy {
 const copy=page.cloneNode(true);
 if(!(copy instanceof HTMLElement))throw new Error('A page copies as an element.');
 return {copy,height:cssRect(page).height,scrolled:capturePageScroll(page)};
}
export function placePageCopy(root: HTMLElement,{copy,height,scrolled}: PageCopy,
 className=PageMotionElement.OUTGOING) {
 copy.classList.add(className);
 copy.hidden=false;
 copy.inert=true;
 copy.setAttribute('aria-hidden','true');
 copy.style.height=`${height}px`;
 for(const node of [copy,...copy.querySelectorAll('[id]')])node.removeAttribute('id');
 root.append(copy);
 restorePageScroll(copy,scrolled);
 return copy;
}

// Chrome stays still while its contents fade. A composed region may instead
// slide only its inner contents (for example a persistent expandable tray).
export interface PageRegions {
 chrome?: string;
 sliding?: {root: string,content: string};
 marks?: {CONTENT: string,CHROME: string,SCAFFOLD: string};
}
export interface PageMotion {
 finished: Promise<unknown>;
 endsAt: number;
 cancel(): void;
}
export function animatePage(page: HTMLElement,frames: Keyframe[],timing: PageTiming,
 {chrome,sliding,marks=PageMotionElement}: PageRegions={}): PageMotion {
 const animations: Animation[]=[],marked: [Element,string][]=[];
 const fade=frames.map(({opacity})=>({opacity})),width=cssRect(page).width;
 const body=frames.map(frame=>typeof frame.transform==='string'?{
  ...frame,transform:frame.transform.replace(/translateX\((-?\d+)%\)/,
   (_,percent)=>`translateX(${Number(percent)*width/100}px)`),
 }:frame);
 const mark=(node: Element,name: string)=>{node.classList.add(name);marked.push([node,name]);};
 const animate=(node: Element,keyframes: Keyframe[])=>{
  mark(node,marks.CONTENT);
  animations.push(node.animate(keyframes,timing));
 };
 const visit=(node: Element)=>{
  if(node instanceof HTMLElement&&node.hidden)return;
  if(sliding&&node.matches(sliding.root)) {
   mark(node,marks.CHROME);
   const content=node.querySelector(sliding.content);
   if(content)animate(content,body);
  }else if(chrome&&node.matches(chrome)) {
   mark(node,marks.CHROME);
   for(const child of node.children) {
    if(child instanceof HTMLElement&&child.hidden)continue;
    if(sliding&&child.matches(sliding.root))visit(child);else animate(child,fade);
   }
  }else if(chrome&&node.querySelector(chrome)) {
   mark(node,marks.SCAFFOLD);
   for(const child of node.children)visit(child);
  }else animate(node,body);
 };
 visit(page);
 const finished=Promise.all(animations.map(animation=>animation.finished));
 finished.catch(()=>{});
 return {finished,endsAt:performance.now()+(timing.delay||0)+timing.duration,cancel:()=>{
  animations.forEach(animation=>animation.cancel());
  marked.forEach(([node,name])=>node.classList.remove(name));
 }};
}
