// The room an element gives what it holds, read as it is laid out.
import { useLayoutEffect, useState, type RefObject } from 'react';

/** An element's inner size, now and whenever it changes; null until it has been laid out. */
export function useRoomSize(room: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const element = room.current!;
    const read = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const sized = new ResizeObserver(read);
    sized.observe(element);
    read();
    return () => sized.disconnect();
  }, [room]);
  return size;
}
