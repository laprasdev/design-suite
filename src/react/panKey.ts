// Whether Space is held: on a canvas that selects by dragging, Space and a drag pans instead. A Space typed into a
// field is the field's and holds nothing. Heard as the page's keys (pageKeys), from first use.
import { KeyMoment, PageKey, onPageKey } from './pageKeys.ts';

const PAN_KEY = ' ';
let held = false, listening = false;
const TYPING = 'input,textarea,select,[contenteditable="true"]';
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest(TYPING);
export function isPanKeyHeld() {
 if (!listening && typeof window !== 'undefined') {
  listening = true;
  onPageKey(PageKey.DOWN, KeyMoment.PAGE_AFTER_FOCUS,
   e => { if (e.key === PAN_KEY && !typing(e.target)) held = true; });
  onPageKey(PageKey.UP, KeyMoment.PAGE_AFTER_FOCUS, e => { if (e.key === PAN_KEY) held = false; });
  window.addEventListener('blur', () => { held = false; });
 }
 return held;
}
