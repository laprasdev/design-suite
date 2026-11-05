// Whether Space is held: on a canvas that selects by dragging, Space and a drag pans instead. One listener for the
// page, installed on first use.
const PAN_KEY = ' ';
let held = false, listening = false;
const TYPING = 'input,textarea,select,[contenteditable="true"]';
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest(TYPING);
export function isPanKeyHeld() {
 if (!listening && typeof window !== 'undefined') {
  listening = true;
  window.addEventListener('keydown', e => { if (e.key === PAN_KEY && !typing(e.target)) held = true; });
  window.addEventListener('keyup', e => { if (e.key === PAN_KEY) held = false; });
  window.addEventListener('blur', () => { held = false; });
 }
 return held;
}
