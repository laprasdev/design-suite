// Escape cancels what a control is in the middle of (a drag, a move, a gesture, an edit), named here and nowhere else.
// A cancel that takes the key marks it handled and stops it: a Modal around the control stays open (Modal dismissal
// stops a handled key without closing), and nothing outside the control acts on it as well.
import {useEffect,useRef} from 'react';

const CANCEL_KEY='Escape';
interface Key {readonly key: string; preventDefault(): void; stopPropagation(): void}

// For a control's own key handler. `cancel` cancels what is in progress and says whether there was anything to cancel.
export function cancelsOnEscape(event: Key,cancel: ()=>boolean) {
 if(event.key!==CANCEL_KEY||!cancel())return false;
 event.preventDefault();event.stopPropagation();
 return true;
}
// For an operation that Escape cancels wherever the focus is: listens on the window while the control is mounted, so
// a render during the same key's dispatch cannot drop the listener. `cancel` is read when the key arrives.
export function useEscapeCancel(cancel: ()=>boolean) {
 const latest=useRef(cancel);
 latest.current=cancel;
 useEffect(()=>{
  const key=(event: KeyboardEvent)=>void cancelsOnEscape(event,()=>latest.current());
  window.addEventListener('keydown',key);
  return()=>window.removeEventListener('keydown',key);
 },[]);
}
