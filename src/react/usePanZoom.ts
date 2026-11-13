// Drag to pan and pinch (or Cmd/Ctrl-scroll) to zoom about the pointer. Scroll moves a canvas that fills its pane;
// graphs embedded in a page leave ordinary scrolling to that page.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {cssRect, zoomOf} from './cssZoom.ts';
import type {PointerEvent as ReactPointerEvent} from 'react';
export interface GraphViewport {width: number; height: number; selecting?: boolean; readable?: boolean;
  fill?: boolean; expand?: boolean;}
const frameElement = (node: HTMLDivElement | null): HTMLDivElement =>
  {if (!node) throw new Error('Graph viewport is not mounted'); return node;};

// Far enough out that a whole playbook fits, its boxes down to their names.
export const ZOOM = Object.freeze({ min: 0.15, max: 2.4, step: 1.2 });
// What a box says at each zoom: just its name when far out, its facts at the fitted size, its latest move close in.
export const Detail = Object.freeze({ FAR: 'far', NORMAL: 'normal', NEAR: 'near' });
const FAR_BELOW = 0.7, NEAR_ABOVE = 1.35;
export const detailAt = (scale: number) => (scale < FAR_BELOW ? Detail.FAR : scale > NEAR_ABOVE ? Detail.NEAR
  : Detail.NORMAL);
const PRESSABLE = 'a,button,input,textarea,[role="button"]';
// Fitting leaves this much of the frame clear, so nothing sits in the faded edges.
const FIT_SHARE = 0.88;
const clamp = (scale: number) => Math.min(ZOOM.max, Math.max(ZOOM.min, scale));
// Task cards use 14px facts, so their minimum scale still draws text above 12px.
const READABLE_SCALE = 0.9, START_SCALE = 1, TOP_INSET = 24;

// Plain empty-space drags pan; modifier drags belong to graph organization.
const MIDDLE_BUTTON = 1;
export function usePanZoom(viewport?: GraphViewport) {
  const {width: contentWidth, height: contentHeight, selecting = false, readable = false, fill = false} = viewport
    ?? {width: 0, height: 0};
  const enabled = viewport !== undefined;
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const automatic = useRef(true);
  const fit = useCallback(() => {
    if (!enabled) return;
    const el = frameElement(frame.current);
    if (!el.clientWidth) return;
    const scale = readable ? Math.max(READABLE_SCALE, Math.min(START_SCALE, el.clientWidth / contentWidth))
      : clamp(FIT_SHARE * Math.min(el.clientWidth / contentWidth, el.clientHeight / contentHeight));
    automatic.current = true;
    setView({ scale, x: (el.clientWidth - contentWidth * scale) / 2,
      y: readable ? TOP_INSET : (el.clientHeight - contentHeight * scale) / 2 });
  }, [contentWidth, contentHeight, readable, enabled]);
  useLayoutEffect(() => { if (automatic.current) fit(); }, [fit]);
  useLayoutEffect(() => {
    if (!enabled || !fill) return;
    const observer = new ResizeObserver(() => { if (automatic.current) fit(); });
    observer.observe(frameElement(frame.current));
    return () => observer.disconnect();
  }, [enabled, fill, fit]);
  // Zooms by a factor about a point in the frame, so what's under the pointer stays under it.
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    automatic.current = false;
    setView(v => {
      const scale = Math.max(readable ? READABLE_SCALE : ZOOM.min, clamp(v.scale * factor)), k = scale / v.scale;
      return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, [readable]);
  const zoomBy = (factor: number) => {
    const el = frameElement(frame.current);
    zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };
  useEffect(() => {
    if (!enabled) return;
    const el = frameElement(frame.current);
    // Pinch arrives as a wheel with Ctrl held; Cmd or Ctrl with a wheel zooms too.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        if (!fill) return;
        e.preventDefault();
        automatic.current = false;
        const zoom = zoomOf(el);
        setView(v => ({ ...v, x: v.x - e.deltaX / zoom, y: v.y - e.deltaY / zoom }));
        return;
      }
      e.preventDefault();
      const box = cssRect(el), zoom = zoomOf(el);
      zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX / zoom - box.left, e.clientY / zoom - box.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, fill, enabled]);
  const drag = useRef<{id: number; x: number; y: number} | null>(null);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // On a canvas that selects, Shift and a drag draws the selection box instead.
    const pans = e.button === MIDDLE_BUTTON || (e.button === 0 && !(selecting && (e.shiftKey || e.altKey)));
    if (!pans || (e.target instanceof Element && e.target.closest(PRESSABLE))) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    automatic.current = false;
    // The pointer moves in screen pixels; the view moves in the page's, which the desk's zoom scales.
    const zoom = zoomOf(e.currentTarget), dx = (e.clientX - d.x) / zoom, dy = (e.clientY - d.y) / zoom;
    drag.current = { ...d, x: e.clientX, y: e.clientY };
    setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) =>
    { if (drag.current?.id === e.pointerId) drag.current = null; };
  return {
    frame, view, zoomBy, fit,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp,
      onPointerDownCapture: (e: ReactPointerEvent<HTMLDivElement>) => {
        if ((e.target instanceof Element
          && e.target.closest('.bd-node-group-resize,.bd-node-group-heading[data-moving]'))) automatic.current = false;
      } },
  };
}
