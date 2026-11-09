import {useRef, type MouseEvent, type PointerEvent} from 'react';
import {LayoutDimensions} from '../layout.ts';

type Press = {x: number; y: number; time: number; pointer: number};
type Activation<T extends HTMLElement> = PointerEvent<T> | MouseEvent<T>;

/** Touch and pen get the same two-press activation as a native mouse double-click. */
export function useDoubleTap<T extends HTMLElement>({onDoubleTap, accepts, slop,
  interval = LayoutDimensions.timing.slow}: {
  onDoubleTap(event: Activation<T>): void; accepts(event: Activation<T>): boolean; slop: number; interval?: number;
}) {
  const down = useRef<Press | null>(null), previous = useRef<Press | null>(null);
  const fired = useRef(-Infinity);
  const cancel = () => {down.current = null; previous.current = null;};
  const point = (event: PointerEvent<T>): Press => ({x: event.clientX, y: event.clientY,
    time: event.timeStamp, pointer: event.pointerId});
  const nearby = (a: Press, b: Press) => Math.hypot(a.x - b.x, a.y - b.y) <= slop;
  return {
    onPointerDown(event: PointerEvent<T>) {
      if (event.pointerType === 'mouse') return;
      if (!event.isPrimary || !accepts(event)) {cancel(); return;}
      down.current = point(event);
    },
    onPointerMove(event: PointerEvent<T>) {
      if (down.current && down.current.pointer === event.pointerId && !nearby(down.current, point(event))) cancel();
    },
    onPointerUp(event: PointerEvent<T>) {
      const start = down.current;
      if (!start || start.pointer !== event.pointerId) return;
      const end = point(event); down.current = null;
      if (!accepts(event) || !nearby(start, end) || end.time - start.time > interval) {cancel(); return;}
      const first = previous.current; previous.current = end;
      if (first && end.time - first.time <= interval && nearby(first, end)) {
        cancel(); fired.current = end.time;
        event.preventDefault(); onDoubleTap(event);
      }
    },
    onPointerCancel: cancel,
    onDoubleClick(event: MouseEvent<T>) {
      if (event.timeStamp - fired.current > interval && accepts(event)) onDoubleTap(event);
    },
  };
}
