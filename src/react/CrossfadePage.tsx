import {useLayoutEffect,useRef,type RefObject} from 'react';
import type {StackView} from './ViewStack.tsx';
import {reducedMotion} from './motion.ts';
import {pageStackDirection,pageStackKeys} from './pageStack.ts';
import {
 animatePage,capturePage,captureRetainedPageScroll,restoreRetainedPageScroll,placePageCopy,removePageCopy,pageFrames,
 type PageCopy,type RetainedPageScroll,
} from './pageMotion.ts';

export const CrossfadePageElement=Object.freeze({SURFACE:'bd-page-stack',PAGE:'bd-page'});
export const PAGE_STACK_MOVING='data-page-moving';
export const PAGE_STACK_DIRECTION='data-page-direction';
export interface CrossfadePageProps {
 form: 'page';
 views: readonly StackView[];
 className?: string;
 // An optional destination heading/control. Back prefers the retained page's
 // previously focused control; otherwise the page itself takes focus.
 focusRef?: RefObject<HTMLElement>;
}
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

// Every retained key is one React mount. Only its DOM snapshot travels out.
export function CrossfadePage({views,className='',focusRef}: CrossfadePageProps) {
 const surface=useRef<HTMLDivElement>(null),pages=useRef(new Map<string,HTMLDivElement>());
 const saved=useRef(new Map<string,RetainedPage>()),shown=useRef<ShownPage|null>(null);
 const leaving=useRef<LeavingPage|null>(null),motion=useRef<(()=>void)|null>(null);
 const keys=pageStackKeys(views),key=keys.at(-1),before=shown.current;
 if(before?.node&&before.key!==key&&(leaving.current?.from!==before||leaving.current.to!==key)) {
  const active=document.activeElement;
  saved.current.set(before.key!,{
   scroll:captureRetainedPageScroll(before.node),
   focus:active instanceof HTMLElement&&before.node.contains(active)?active:null,
  });
  leaving.current={from:before,to:key,copy:capturePage(before.node)};
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
  for(const [id,page] of pages.current)page.inert=id!==key;
  const outgoing=leaving.current?.from===previous&&leaving.current.to===key?leaving.current.copy:null;
  leaving.current=null;
  if(!node)return;
  const retained=key===undefined?undefined:saved.current.get(key);
  if(retained)restoreRetainedPageScroll(node,retained.scroll);
  const direction=pageStackDirection(previous?.keys??[],keys);
  const focus=()=>{
   const prior=direction<0?retained?.focus:null;
   for(const target of [prior&&node.contains(prior)?prior:null,focusRef?.current,node]) {
    if(!target?.isConnected)continue;
    target.focus({preventScroll:true});
    if(node.ownerDocument.activeElement===target)return;
   }
  };
  if(!previous){if(focusRef?.current)focus();return;}
  if(!outgoing||reducedMotion()){focus();return;}
  const copy=placePageCopy(root,outgoing),frames=pageFrames(direction);
  root.setAttribute(PAGE_STACK_MOVING,'true');
  root.setAttribute(PAGE_STACK_DIRECTION,String(direction));
  node.inert=true;
  const exit=animatePage(copy,...frames.outgoing),enter=animatePage(node,...frames.incoming);
  const stop=()=>{
   exit.cancel();enter.cancel();removePageCopy(outgoing);node.inert=false;
   root.removeAttribute(PAGE_STACK_MOVING);root.removeAttribute(PAGE_STACK_DIRECTION);
  };
  motion.current=stop;
  enter.finished.then(()=>{
   if(motion.current!==stop)return;
   stop();motion.current=null;focus();
  },()=>{});
 });
 useLayoutEffect(()=>()=>{motion.current?.();motion.current=null;},[]);
 return <div ref={surface} className={`${CrossfadePageElement.SURFACE}${className?` ${className}`:''}`}>
  {views.map(view=><div key={view.key} ref={node=>{
   if(node)pages.current.set(view.key,node);else pages.current.delete(view.key);
  }} className={CrossfadePageElement.PAGE} hidden={view.key!==key} aria-hidden={view.key!==key||undefined}
   tabIndex={-1}>{view.node}</div>)}
 </div>;
}
