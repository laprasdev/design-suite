/* Modal — the one overlay primitive. A themed, centered box over a dimmed
   backdrop that fades in on open and out on close. Behaviour is composed via
   props, never subclassed:
     · dismissible   → backdrop click / Esc calls onClose (default true)
     · blocking      → while open, the page outside the modal is inert and focus
                       moves into the dialog, returning where it was on close
     · returnFocusRef → the invoking control, when opening disables or blurs it
                        before the modal can capture document.activeElement
     · ariaLabel     → the dialog's accessible name, or labelledBy → the id of
                       the heading that names it
     · keepRoomFor   → a selector for content that opens inside the dialog; the
                       dialog keeps room for its height (useHeldTop)
   Content (header, ✕, body) is passed as children; the shell owns only the
   backdrop, placement (useHeldTop), and fade. Themed through host CSS custom
   properties, so a consuming app's palette drives it. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type SyntheticEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {focusableControls} from './focusable.ts';
import {KEPT_ROOM_ATTRIBUTE,SCROLL_STEP_PX,keptRoom,modalGrowthLimit} from './modalRoom.ts';
import { cssRect } from './cssZoom.ts';
const FADE_MS = 200;

/* Keep a node mounted through its fade-out, returning [mounted, visible].
   `visible` flips true on the frame after mount so the CSS transition runs. */
function useFadeMount(open: boolean): [boolean, boolean] {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) return setMounted(true);
    setVisible(false);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!mounted) return;
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, [mounted]);
  return [mounted, visible];
}

/* Makes everything outside `node` inert: each sibling of the node and of every
   ancestor up to the body. Returns a function that restores those siblings. */
function inertOutside(node: HTMLElement) {
  const changed: HTMLElement[] = [];
  for (let child: HTMLElement = node, parent = node.parentElement; parent && child !== document.body; child = parent, parent = parent.parentElement)
    for (const sibling of parent.children)
      if (sibling !== child && sibling instanceof HTMLElement && !sibling.inert) { sibling.inert = true; changed.push(sibling); }
  return () => changed.forEach((sibling) => { sibling.inert = false; });
}

/* A dialog opens centred. Once a disclosure inside it is used (a control that
   expands content, or a details summary), it holds its top edge: what opens or
   closes beneath the control grows or shrinks the dialog downward with it, so the
   control stays under the pointer, until the dialog's growth limit and the room
   beneath run out and it scrolls within. A resize of its parent centres it again. A dialog
   that keeps room for content (`keepRoomFor`) rests that much short of its maximum
   height and is centred with the room beneath it, for its held growth to fill.
   Returns the handlers that hold it and follow what a control opens. */
const DISCLOSURE = "[aria-expanded], summary", PLACED = ["alignSelf", "marginTop", "maxHeight", "marginBottom"] as const;
// The dialog's top as laid out, without its entrance transform (a rise, and a scale
// about its centre).
function layoutTop(node: HTMLElement) {
  const box = cssRect(node), entrance = new DOMMatrixReadOnly(getComputedStyle(node).transform);
  return box.top - entrance.f - box.height * (1 / entrance.d - 1) / 2;
}
// The backdrop's height inside its padding: the apparent parent.
function parentHeight(backdrop: HTMLElement) {
  const area = getComputedStyle(backdrop);
  return backdrop.clientHeight - parseFloat(area.paddingTop) - parseFloat(area.paddingBottom);
}
// The dialog's maximum height from its stylesheet, beneath any held or resting limit.
function styledMaxHeight(node: HTMLElement) {
  const inline = node.style.maxHeight;
  node.style.maxHeight = "";
  const max = parseFloat(getComputedStyle(node).maxHeight);
  node.style.maxHeight = inline;
  return max;
}
// Finite motion still running inside the dialog (its content opening or closing).
const moving = (node: Element) => node.getAnimations({ subtree: true }).some((animation) => animation.playState === "running" && animation.effect !== null && animation.effect.getTiming().iterations !== Infinity);
// The browser has clamped the dialog's scroll short of `scrollTop` to content that
// got shorter: it rests at its furthest.
const clamped = (node: HTMLElement, scrollTop: number) => node.scrollTop < scrollTop && node.scrollTop + node.clientHeight >= node.scrollHeight - SCROLL_STEP_PX;
// At rest a dialog that keeps room watches its content's size; held, it follows
// its content frame by frame while that moves, so it never measures a size
// another component's resize observer is still changing. Its content can also
// start to move after a frame in which nothing did: a box that resizes as the
// content inside it settles does so from its own resize observer, after that
// frame's follow, and a slow frame can see a whole opening finish unseen. Held, a
// change inside it (its content, or a style such as that box's new height) is
// followed from the next frame. A resize observer cannot watch for it: a box
// resizing from its own observer would leave the dialog's notification
// undelivered, an error in WebKit.
// A held dialog: the height and content height it was held at, the content
// height last followed, the scroll its control was used at, and its growth limit.
interface HeldDialog {
  height: number;
  content: number;
  followed: number;
  scrollTop: number;
  limit: number;
}
function useHeldTop(mounted: boolean, keepRoomFor: string | undefined, backdrop: RefObject<HTMLDivElement>, dialog: RefObject<HTMLDivElement>) {
  const room = useRef(0), held = useRef<HeldDialog | null>(null), watch = useRef<ResizeObserver | null>(null), frame = useRef(0);
  useLayoutEffect(() => {
    const node = dialog.current, area = backdrop.current;
    if (!mounted || !node || !area) return;
    // Centred, keeping room beneath the dialog for the content's height.
    const place = () => {
      for (const key of PLACED) node.style[key] = "";
      const parent = parentHeight(area), max = styledMaxHeight(node);
      const content = keepRoomFor ? Math.max(0, ...Array.from(node.querySelectorAll<HTMLElement>(keepRoomFor), (part) => part.offsetHeight)) : 0;
      room.current = keptRoom(content, max, parent);
      node.setAttribute(KEPT_ROOM_ATTRIBUTE, String(room.current));
      if (!room.current) return;
      node.style.maxHeight = `${Math.floor(Math.min(max, parent) - room.current)}px`;
      node.style.marginBottom = `${Math.max(0, 2 * room.current - (parent - node.offsetHeight))}px`;
    };
    // The apparent parent's size the dialog was placed in. Only a new size centres
    // it again: some engines report a resize when nothing changed (WebKit on
    // Linux), which must not drop a hold between pressing a control and its click.
    const parentSize = () => `${area.clientWidth}x${area.clientHeight}`;
    let placedIn: string | null = null;
    const watcher = new ResizeObserver(place);
    const release = () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      held.current = null;
      placedIn = parentSize();
      if (keepRoomFor) for (const child of node.children) watcher.observe(child);
      place();
    };
    const resized = () => { if (parentSize() !== placedIn) release(); };
    watch.current = watcher;
    // The dialog's own style is the follow's; changes beneath it re-arm the follow.
    const changes = new MutationObserver((records) => { if (held.current && records.some((record) => record.target !== node)) arm(); });
    changes.observe(node, { subtree: true, childList: true, attributes: true, characterData: true });
    release();
    window.addEventListener("resize", resized);
    return () => { cancelAnimationFrame(frame.current); watcher.disconnect(); changes.disconnect(); window.removeEventListener("resize", resized); };
  }, [mounted, keepRoomFor]);
  // Held, it grows by what its content grows from the height it was held at, up
  // to its limit, so nothing it already shows moves or scrolls. Content that
  // closes shrinks the dialog with it; where the browser has clamped the scroll to
  // the shorter content, the dialog returns to the scroll it had when its control
  // was used, before paint, so that control stays under the pointer. A scroll the
  // reader has made since is kept.
  const follow = () => {
    frame.current = 0;
    const node = dialog.current, state = held.current;
    if (!node || !state) return;
    const scrollHeight = node.scrollHeight;
    if (!clamped(node, state.scrollTop) && Math.abs(node.scrollTop - state.scrollTop) >= SCROLL_STEP_PX) state.scrollTop = node.scrollTop;
    node.style.maxHeight = `${Math.min(state.limit, state.height + Math.max(0, scrollHeight - state.content))}px`;
    node.scrollTop = state.scrollTop;
    const changed = scrollHeight !== state.followed;
    state.followed = scrollHeight;
    if (changed || moving(node)) frame.current = requestAnimationFrame(follow);
  };
  // The content changed while held: follow it from the next frame, unless already
  // following.
  const arm = () => { if (!frame.current) frame.current = requestAnimationFrame(follow); };
  const hold = (event: SyntheticEvent) => {
    const node = dialog.current, area = backdrop.current;
    if (!node || !area || !(event.target instanceof Element) || !event.target.closest(DISCLOSURE)) return;
    if (held.current) {
      // Held already: keep the scroll the control is used at.
      held.current.scrollTop = node.scrollTop;
      return;
    }
    const inset = parseFloat(getComputedStyle(area).paddingTop), top = layoutTop(node) - cssRect(area).top - inset;
    const parent = parentHeight(area), height = node.offsetHeight;
    watch.current?.disconnect();
    // Bound expansion to the apparent parent and the room kept, without shrinking
    // an already taller dialog under the control that was just activated. Whole
    // pixels keep every scroll position the browser clamps to exact.
    held.current = {height, content: node.scrollHeight, followed: node.scrollHeight, scrollTop: node.scrollTop, limit: Math.floor(Math.min(styledMaxHeight(node), parent - top, modalGrowthLimit(height, parent, room.current)))};
    Object.assign(node.style, { alignSelf: "start", marginTop: `${top}px`, marginBottom: "", maxHeight: `${height}px` });
  };
  // A used control opens or closes its content: follow it until it settles.
  const opened = (event: SyntheticEvent) => {
    if (!held.current || !(event.target instanceof Element) || !event.target.closest(DISCLOSURE)) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(follow);
  };
  return {hold, opened};
}

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  dismissible?: boolean;
  dismissOnContent?: boolean;
  blocking?: boolean;
  returnFocusRef?: RefObject<HTMLElement>;
  ariaLabel?: string;
  labelledBy?: string;
  keepRoomFor?: string;
  className?: string;
  children: ReactNode;
}
export function Modal({ open, onClose, dismissible = true, dismissOnContent = false, blocking = false, returnFocusRef, ariaLabel, labelledBy, keepRoomFor, className = "", children }: ModalProps) {
  const [mounted, visible] = useFadeMount(open);
  const backdrop = useRef<HTMLDivElement>(null), dialog = useRef<HTMLDivElement>(null), {hold, opened} = useHeldTop(mounted, keepRoomFor, backdrop, dialog);
  const blocked = blocking && open && mounted;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = () => onCloseRef.current?.();
  const interactive = dismissible;
  // An ancestor scroll container can itself be a tab stop even when every
  // sibling outside the dialog is inert. Keep both Tab directions in the dialog.
  const containFocus = (event: ReactKeyboardEvent) => {
    const node = dialog.current;
    if (!blocked || event.key !== 'Tab' || !node) return;
    const controls = focusableControls(node), first = controls[0], last = controls.at(-1);
    if (!first || event.shiftKey && (document.activeElement === first || document.activeElement === node) || !event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  };

  useEffect(() => {
    if (!open || !interactive) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, interactive]);

  useEffect(() => {
    const node = dialog.current, area = backdrop.current;
    if (!blocked || !node || !area) return;
    const returnFocus = returnFocusRef?.current || (document.activeElement instanceof HTMLElement ? document.activeElement : null), restore = inertOutside(area);
    if (!node.contains(document.activeElement)) node.focus();
    return () => { restore(); if (returnFocus?.isConnected) returnFocus.focus(); };
  }, [blocked]);

  if (!mounted) return null;
  return (
    <div ref={backdrop} className={`sd-modal-bg${visible ? " sd-in" : ""}`} onClick={interactive ? close : undefined}>
      <div ref={dialog} className={`sd-modal${className ? " " + className : ""}`} role="dialog" aria-modal="true" data-dismissible={interactive}
        aria-label={ariaLabel} aria-labelledby={labelledBy} tabIndex={blocking ? -1 : undefined} onClick={(e) => {e.stopPropagation();if(interactive&&dismissOnContent&&e.target instanceof Element&&!e.target.closest('button,a,input,textarea,select,label,summary,[role=button]'))close();}}
        onPointerDownCapture={hold} onKeyDownCapture={hold} onClickCapture={opened} onKeyDown={containFocus}>
        {children}
      </div>
    </div>
  );
}
