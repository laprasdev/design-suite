// A key going down or up on the page, heard by what is not focused, owned here and nowhere else, and the order it is
// heard in. The window's listeners for it are installed while anything listens; within a moment, listeners hear the
// key in the order they began.
export const PageKey = Object.freeze({ DOWN: 'keydown', UP: 'keyup' } as const);
export type PageKeyValue = (typeof PageKey)[keyof typeof PageKey];
// When a listener hears the key, named for what hears it there, in order. What is under way (a drag, a move, a
// gesture) and then what is open over the content (a Modal) hear it in the window's capture phase, before anything on
// the page; the page after focus hears it in the window's bubble phase, once the focused element and everything around
// it have let it pass.
export const KeyMoment = Object.freeze({
 UNDER_WAY: 'under-way', OPEN_OVER_CONTENT: 'open-over-content', PAGE_AFTER_FOCUS: 'page-after-focus',
} as const);
export type KeyMomentValue = (typeof KeyMoment)[keyof typeof KeyMoment];
type KeyListener = (event: KeyboardEvent) => void;
interface Hearing { readonly way: PageKeyValue; readonly moment: KeyMomentValue; readonly listener: KeyListener }
const hearings = new Set<Hearing>();
const hand = (moments: readonly KeyMomentValue[]) => (event: KeyboardEvent) => {
 for (const moment of moments) for (const hearing of hearings)
  if (hearing.moment === moment && hearing.way === event.type) hearing.listener(event);
};
const beforePage = hand([KeyMoment.UNDER_WAY, KeyMoment.OPEN_OVER_CONTENT]);
const afterPage = hand([KeyMoment.PAGE_AFTER_FOCUS]);
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
