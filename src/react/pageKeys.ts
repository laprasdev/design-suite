// A key going down or up on the page, heard by what is not focused, owned here and nowhere else, and the order it is
// heard in. The window's listeners for it are installed while anything listens; within a moment, listeners hear the
// key in the order they began.
export const PageKey = Object.freeze({ DOWN: 'keydown', UP: 'keyup' } as const);
export type PageKeyValue = (typeof PageKey)[keyof typeof PageKey];
// When a listener hears the key. FIRST and SECOND come in the window's capture phase, before anything on the page:
// what is under way takes the key FIRST, and SECOND hears it once that has had it. LAST comes in the window's bubble
// phase, after everything on the page that let the key pass.
export const KeyMoment = Object.freeze({ FIRST: 'first', SECOND: 'second', LAST: 'last' } as const);
export type KeyMomentValue = (typeof KeyMoment)[keyof typeof KeyMoment];
type KeyListener = (event: KeyboardEvent) => void;
interface Hearing { readonly way: PageKeyValue; readonly moment: KeyMomentValue; readonly listener: KeyListener }
const hearings = new Set<Hearing>();
const hand = (moments: readonly KeyMomentValue[]) => (event: KeyboardEvent) => {
 for (const moment of moments) for (const hearing of hearings)
  if (hearing.moment === moment && hearing.way === event.type) hearing.listener(event);
};
const beforePage = hand([KeyMoment.FIRST, KeyMoment.SECOND]), afterPage = hand([KeyMoment.LAST]);
function listen() {
 window.addEventListener('keydown', beforePage, true); window.addEventListener('keyup', beforePage, true);
 window.addEventListener('keydown', afterPage); window.addEventListener('keyup', afterPage);
}
function stopListening() {
 window.removeEventListener('keydown', beforePage, true); window.removeEventListener('keyup', beforePage, true);
 window.removeEventListener('keydown', afterPage); window.removeEventListener('keyup', afterPage);
}

// Hands each key going `way` on the page to `listener` at `moment` until the returned function is called.
export function onPageKey(way: PageKeyValue, moment: KeyMomentValue, listener: KeyListener) {
 const hearing: Hearing = { way, moment, listener };
 if (!hearings.size) listen();
 hearings.add(hearing);
 return () => {
  hearings.delete(hearing);
  if (!hearings.size) stopListening();
 };
}

// Whether Space is held: on a canvas that selects by dragging, Space and a drag pans instead. A Space typed into a
// field is the field's and holds nothing. Heard from first use.
const PAN_KEY = ' ';
let held = false, listening = false;
const TYPING = 'input,textarea,select,[contenteditable="true"]';
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest(TYPING);
export function isPanKeyHeld() {
 if (!listening && typeof window !== 'undefined') {
  listening = true;
  onPageKey(PageKey.DOWN, KeyMoment.LAST, e => { if (e.key === PAN_KEY && !typing(e.target)) held = true; });
  onPageKey(PageKey.UP, KeyMoment.LAST, e => { if (e.key === PAN_KEY) held = false; });
  window.addEventListener('blur', () => { held = false; });
 }
 return held;
}
