// A key going down or up on the page, heard by what is not focused, owned here and nowhere else: the window's one
// listener for each way, installed while anything listens, hands every key to each listener in the order they began.
export const PageKey = Object.freeze({ DOWN: 'keydown', UP: 'keyup' } as const);
export type PageKeyValue = (typeof PageKey)[keyof typeof PageKey];
interface Hearing { readonly way: PageKeyValue; readonly listener: (event: KeyboardEvent) => void }
const hearings = new Set<Hearing>();
const hear = (event: KeyboardEvent) => {
 for (const hearing of hearings) if (hearing.way === event.type) hearing.listener(event);
};

// Hands each key going `way` on the page to `listener` until the returned function is called.
export function onPageKey(way: PageKeyValue, listener: (event: KeyboardEvent) => void) {
 const hearing: Hearing = { way, listener };
 if (!hearings.size) { window.addEventListener('keydown', hear); window.addEventListener('keyup', hear); }
 hearings.add(hearing);
 return () => {
  hearings.delete(hearing);
  if (!hearings.size) { window.removeEventListener('keydown', hear); window.removeEventListener('keyup', hear); }
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
  onPageKey(PageKey.DOWN, e => { if (e.key === PAN_KEY && !typing(e.target)) held = true; });
  onPageKey(PageKey.UP, e => { if (e.key === PAN_KEY) held = false; });
  window.addEventListener('blur', () => { held = false; });
 }
 return held;
}
