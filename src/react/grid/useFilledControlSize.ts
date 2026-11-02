import { useCallback, useRef, useState } from 'react';
import { D } from '../../synth/design/index.ts';

const G = D.moduleGrid;
const clamp = (value: number, lowest: number, highest: number) => Math.min(highest, Math.max(lowest, value));

/** A knob's size in a filled grid: its cell's room less the field's text, within the limits, as the tile resizes. */
export function useFilledControlSize(rows: number) {
  const [size, setSize] = useState<number>(G.controlMin);
  const observer = useRef<ResizeObserver | null>(null);
  const grid = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    const measure = () => {
      const columnRoom = (element.clientWidth - G.fillPadding * 2 - G.fillGap * (G.columns - 1)) / G.columns;
      const width = Math.min(G.fillColumnMax, columnRoom);
      const height = (element.clientHeight - G.fillPadding * 2 - G.fillGap * (rows - 1)) / rows - G.fieldTextRoom;
      setSize(clamp(Math.round(Math.min(width, height) * G.controlShare), G.controlMin, G.controlMax));
    };
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
    measure();
  }, [rows]);
  return { grid, size };
}
