// A drag from its press to its end as the window hears it, owned here for every control that drags: while it lasts,
// each move moves it, a release anywhere or the window losing focus ends it, Enter or Tab ends it where it is, and
// Escape cancels it (controlCancel). It hears keys as what is under way (pageKeys), so a Modal around it stays open.
// The control says whether a drag is under way and what each of these does; the latest is read when its event arrives.
import {useEffect,useRef} from 'react';
import {cancelsOnEscape} from './controlCancel.ts';
import {KeyMoment,PageKey,onPageKey} from './pageKeys.ts';

const ENDS_DRAG: ReadonlySet<string>=new Set(['Enter','Tab']);
export interface DragSession {
 // Absent for a session that only lasts as long as the press, moving nothing itself.
 readonly move?: (event: MouseEvent)=>void;
 readonly end: ()=>void;
 readonly cancel: ()=>void;
}
export function useDragSession(active: boolean,session: DragSession) {
 const latest=useRef(session);
 latest.current=session;
 useEffect(()=>{
  if(!active)return;
  const move=(event: MouseEvent)=>latest.current.move?.(event),end=()=>latest.current.end();
  const key=(event: KeyboardEvent)=>{
   if(!cancelsOnEscape(event,()=>{latest.current.cancel();return true;})&&ENDS_DRAG.has(event.key))end();
  };
  window.addEventListener('mousemove',move);window.addEventListener('mouseup',end);window.addEventListener('blur',end);
  const stopHearing=onPageKey(PageKey.DOWN,KeyMoment.UNDER_WAY,key);
  return()=>{
   window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',end);
   window.removeEventListener('blur',end);stopHearing();
  };
 },[active]);
}
