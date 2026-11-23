import {useLayoutEffect,useRef,type RefObject} from 'react';
import type {StackView} from './ViewStack.tsx';
import {reducedMotion} from './motion.ts';
import {pageStackDirection,pageStackKeys} from './pageStack.ts';
import {
 animatePage,capturePage,captureRetainedPageScroll,restoreRetainedPageScroll,placePageCopy,removePageCopy,pageFrames,
 type PageCopy,type RetainedPageScroll,
} from './pageMotion.ts';

import {
 CAROUSEL_INACTIVE,CrossfadeForm,CrossfadePageElement,PAGE_STACK_DIRECTION,PAGE_STACK_MOVING,
} from './crossfadeElements.ts';
export {CrossfadeForm,CrossfadePageElement,PAGE_STACK_DIRECTION,PAGE_STACK_MOVING};

export interface CrossfadePageProps {
 form: typeof CrossfadeForm.PAGE;
 /** Ordered peer pages use the same stack, retaining each visited mount. */
 activeKey?: string;
 views: readonly StackView[];
 className?: string;
 // An optional destination heading/control. Back prefers the retained page's
 // previously focused control; otherwise the page itself takes focus.
 focusRef?: RefObject<HTMLElement>;
}
export interface CrossfadeCarouselProps {
 form: typeof CrossfadeForm.CAROUSEL;
 /** The shown item's key among ordered peers mounted together in one cell. */
 activeKey: string;
 views: readonly StackView[];
 className?: string;
}
export type CrossfadeStackProps=CrossfadePageProps|CrossfadeCarouselProps;

interface RetainedPage {
 scroll: RetainedPageScroll;
 focus: HTMLElement|null;
}
interface ShownPage {
 keys: string[];
 key: string|undefined;
 node: HTMLElement|null;
}
interface LeavingPage {
 from: ShownPage;
 to: string|undefined;
 copy: PageCopy;
}

// Every retained key is one React mount. Peer pages and carousel items travel themselves; popped pages leave a DOM
// snapshot. A carousel mounts every peer in one cell so the cell keeps the widest item's measured width.
export function CrossfadePage(props: CrossfadeStackProps) {
 const {form,views,className='',activeKey}=props;
 const carousel=form===CrossfadeForm.CAROUSEL,focusRef=carousel?undefined:props.focusRef;
 const surface=useRef<HTMLDivElement>(null),pages=useRef(new Map<string,HTMLDivElement>());
 const saved=useRef(new Map<string,RetainedPage>()),shown=useRef<ShownPage|null>(null);
 const leaving=useRef<LeavingPage|null>(null),motion=useRef<(()=>void)|null>(null);
 const visited=useRef(new Set<string>());
 const keys=pageStackKeys(views),key=activeKey??keys.at(-1),before=shown.current;
 if(activeKey!==undefined&&!keys.includes(activeKey))throw new Error('The active page must be registered.');
 if(key!==undefined)visited.current.add(key);
 if(!carousel&&before?.node&&before.key!==key&&(leaving.current?.from!==before||leaving.current.to!==key)) {
  const active=document.activeElement;
  saved.current.set(before.key!,{
   scroll:captureRetainedPageScroll(before.node),
   focus:active instanceof HTMLElement&&before.node.contains(active)?active:null,
  });
  if(activeKey===undefined)leaving.current={from:before,to:key,copy:capturePage(before.node)};
 }
 useLayoutEffect(()=>{
  const root=surface.current,node=key===undefined?null:pages.current.get(key)??null;
  if(!root)return;
  const previous=shown.current;
  shown.current={keys,key,node};
  for(const retained of saved.current.keys())if(!keys.includes(retained))saved.current.delete(retained);
  for(const [id,page] of pages.current)if(id!==key)page.inert=true;
  if(previous&&previous.key===key&&previous.node===node)return;
  motion.current?.();
  motion.current=null;
  for(const [id,page] of pages.current) {
   page.inert=id!==key;
   if(carousel)page.toggleAttribute(CAROUSEL_INACTIVE,id!==key);
   else page.hidden=id!==key;
  }
  const outgoing=leaving.current?.from===previous&&leaving.current.to===key?leaving.current.copy:null;
  leaving.current=null;
  if(!node)return;
  const retained=key===undefined?undefined:saved.current.get(key);
  if(retained)restoreRetainedPageScroll(node,retained.scroll);
  const direction=activeKey!==undefined&&previous?.key!==undefined
   ? Math.sign(keys.indexOf(key!)-keys.indexOf(previous.key)) as -1|0|1
   : pageStackDirection(previous?.keys??[],keys);
  const focus=()=>{
   if(carousel)return;
   const prior=direction<0?retained?.focus:null;
   for(const target of [prior&&node.contains(prior)?prior:null,focusRef?.current,node]) {
    if(!target?.isConnected)continue;
    target.focus({preventScroll:true});
    if(node.ownerDocument.activeElement===target)return;
   }
  };
  if(!previous){if(focusRef?.current)focus();return;}
  const retainedOutgoing=activeKey!==undefined?previous.node:null;
  if((!outgoing&&!retainedOutgoing)||reducedMotion()){focus();return;}
  // Peer navigation animates the retained mount itself: no duplicate iframe or running preview.
  const copy=retainedOutgoing??placePageCopy(root,outgoing!),frames=pageFrames(direction);
  if(carousel){copy.removeAttribute(CAROUSEL_INACTIVE);copy.classList.add(CrossfadePageElement.CAROUSEL_LEAVING);}
  else if(retainedOutgoing){copy.hidden=false;copy.classList.add('bd-page-leaving');}
  root.setAttribute(PAGE_STACK_MOVING,'true');
  root.setAttribute(PAGE_STACK_DIRECTION,String(direction));
  node.inert=true;
  const regions=carousel?undefined:{chrome:'[data-page-bar]'};
  const exit=animatePage(copy,...frames.outgoing,regions),enter=animatePage(node,...frames.incoming,regions);
  const stop=()=>{
   exit.cancel();enter.cancel();
   if(carousel){copy.classList.remove(CrossfadePageElement.CAROUSEL_LEAVING);
    copy.toggleAttribute(CAROUSEL_INACTIVE,copy!==node);}
   else if(retainedOutgoing){copy.classList.remove('bd-page-leaving');copy.hidden=true;}
   else removePageCopy(outgoing!);
   node.inert=false;
   root.removeAttribute(PAGE_STACK_MOVING);root.removeAttribute(PAGE_STACK_DIRECTION);
  };
  motion.current=stop;
  enter.finished.then(()=>{
   if(motion.current!==stop)return;
   stop();motion.current=null;focus();
  },()=>{});
 });
 useLayoutEffect(()=>()=>{motion.current?.();motion.current=null;},[]);
 return <div ref={surface} data-form={form}
  className={`${CrossfadePageElement.SURFACE}${className?` ${className}`:''}`}>
  {views.filter(view=>carousel||activeKey===undefined||visited.current.has(view.key)).map(view=>{
   const active=view.key===key;
   return <div key={view.key} ref={node=>{
    if(node)pages.current.set(view.key,node);else pages.current.delete(view.key);
   }} className={CrossfadePageElement.PAGE} hidden={!carousel&&!active}
    data-inactive={carousel&&!active?'':undefined} aria-hidden={!active||undefined}
    tabIndex={carousel?undefined:-1}>{view.node}</div>;
  })}
 </div>;
}
