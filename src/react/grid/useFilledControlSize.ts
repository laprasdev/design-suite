import { useCallback, useRef, useState } from 'react';
import { D } from '../../synth/design/index.ts';

const G = D.moduleGrid;
const clamp = (value: number, lowest: number, highest: number) => Math.min(highest, Math.max(lowest, value));

/**
 * A knob's size in a filled grid: its column's room, within the limits, as the tile resizes. Never the tile's height:
 * a tile sized to its content would then size its content by itself.
 */
export function useFilledControlSize(columns: number = G.columns) {
  const [size, setSize] = useState<number>(G.controlMin);
  const observer = useRef<ResizeObserver | null>(null);
  const grid = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    const measure = () => {
      const columnRoom = (element.clientWidth - G.fillPadding * 2 - G.fillGap * (columns - 1)) / columns;
      setSize(clamp(Math.round(Math.min(G.fillColumnMax, columnRoom) * G.controlShare), G.controlMin, G.controlMax));
    };
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
    measure();
  }, [columns]);
  return { grid, size };
}
