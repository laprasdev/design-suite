import {useEffect, useRef, type MouseEvent, type PointerEvent} from 'react';
import {LayoutDimensions} from '../layout.ts';

type Press = {x: number; y: number; time: number; pointer: number};
type Activation<T extends HTMLElement> = PointerEvent<T> | MouseEvent<T>;

/**
 * Touch and pen get the same two-press activation as a native mouse double-click. With `onTap`, a press of any pointer
 * that lets go where it started taps once no second press follows within `interval`, so a tap, a double-tap and a
 * press that moves past `slop` never answer the same press.
 */
export function useDoubleTap<T extends HTMLElement>({onDoubleTap, onTap, accepts, slop,
  interval = LayoutDimensions.timing.slow}: {
  onDoubleTap(event: Activation<T>): void; onTap?(): void; accepts(event: Activation<T>): boolean; slop: number;
  interval?: number;
}) {
  const down = useRef<Press | null>(null), previous = useRef<Press | null>(null);
  const fired = useRef(-Infinity), tap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A tap waits out the interval, and any press or double-click within it takes its place.
  const settle = () => {clearTimeout(tap.current); tap.current = undefined;};
  useEffect(() => settle, []);
  const cancel = () => {down.current = null; previous.current = null;};
  const point = (event: PointerEvent<T>): Press => ({x: event.clientX, y: event.clientY,
    time: event.timeStamp, pointer: event.pointerId});
  const nearby = (a: Press, b: Press) => Math.hypot(a.x - b.x, a.y - b.y) <= slop;
  // A mouse's second press is the native double-click's.
  const doubleTapped = (event: PointerEvent<T>, end: Press) => {
    if (event.pointerType === 'mouse') return false;
    const first = previous.current; previous.current = end;
    if (!first || end.time - first.time > interval || !nearby(first, end)) return false;
    cancel(); fired.current = end.time;
    event.preventDefault(); onDoubleTap(event);
    return true;
  };
  return {
    onPointerDown(event: PointerEvent<T>) {
      if (!event.isPrimary || !accepts(event)) {cancel(); return;}
      settle(); down.current = point(event);
    },
    onPointerMove(event: PointerEvent<T>) {
      if (down.current && down.current.pointer === event.pointerId && !nearby(down.current, point(event))) cancel();
    },
    onPointerUp(event: PointerEvent<T>) {
      const start = down.current;
      if (!start || start.pointer !== event.pointerId) return;
      const end = point(event); down.current = null;
      if (!accepts(event) || !nearby(start, end) || end.time - start.time > interval) {cancel(); return;}
      if (doubleTapped(event, end) || !onTap) return;
      tap.current = setTimeout(() => {tap.current = undefined; onTap();}, interval);
    },
    onPointerCancel: cancel,
    onDoubleClick(event: MouseEvent<T>) {
      settle();
      if (event.timeStamp - fired.current > interval && accepts(event)) onDoubleTap(event);
    },
  };
}
