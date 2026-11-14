// Escape cancels what a control is in the middle of (a drag, a move, a gesture, an edit) or clears what it has
// selected, named here and nowhere else. A cancel that takes the key marks it handled and stops it: a Modal around the
// control stays open (Modal dismissal stops a handled key without closing), and nothing outside the control acts on it
// as well.
import {useEffect,useRef} from 'react';
import {KeyMoment,PageKey,onPageKey} from './pageKeys.ts';

const CANCEL_KEY='Escape';
interface Key {readonly key: string; preventDefault(): void; stopPropagation(): void}

// For a control's own key handler. `cancel` cancels what is in progress and says whether there was anything to cancel.
export function cancelsOnEscape(event: Key,cancel: ()=>boolean) {
 if(event.key!==CANCEL_KEY||!cancel())return false;
 event.preventDefault();event.stopPropagation();
 return true;
}
// For an operation that Escape cancels wherever the focus is, heard at its moment (pageKeys): what is under way, a
// drag, a move or a gesture, before any Modal or focused control; a selection with the page after focus, once every
// Modal and focused control has let the key pass, so Escape closes a dialog over it, or cancels a focused control's
// edit, first. Hears Escape while the control is mounted, so a render during the same key's dispatch cannot drop the
// listener. `cancel` is read when the key arrives.
export function useEscapeCancel(moment: typeof KeyMoment.UNDER_WAY|typeof KeyMoment.PAGE_AFTER_FOCUS,
 cancel: ()=>boolean) {
 const latest=useRef(cancel);
 latest.current=cancel;
 useEffect(()=>onPageKey(PageKey.DOWN,moment,event=>void cancelsOnEscape(event,()=>latest.current())),[moment]);
}
