import { useCallback, useRef, useState } from 'react';
import { D } from '../../synth/design/index.ts';

const G = D.moduleGrid;
const clamp = (value: number, lowest: number, highest: number) => Math.min(highest, Math.max(lowest, value));
/** What a field writes beside or beneath its control: its name and its reading. */
const CAPTION = '[data-field-name], [data-field-value]';

/** The widest caption piece the grid draws, as laid out: what a caption beside its knob takes past the knob. */
const captionWidthIn = (element: HTMLElement) =>
  Math.max(0, ...[...element.querySelectorAll(CAPTION)].map(piece => piece.getBoundingClientRect().width));

/**
 * A knob's size in a filled grid, and whether its caption sits beneath it or beside it, chosen by the room the grid is
 * given. One law sizes the knob: a φ step of the room left for it, which is the whole column when the caption goes
 * beneath, and the column less the caption, no more than a row, when it goes beside. The caption goes beneath only
 * where the column holds the caption and each row holds the knob with its caption under it. The grid's size is the
 * layout's, never its content's (it scrolls), and only a resize measures, so reading it cannot feed back.
 */
export function useFilledControlSize(columns: number, rows: number) {
  const [fit, setFit] = useState({ size: G.controlMin, beside: false });
  const observer = useRef<ResizeObserver | null>(null);
  const grid = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    const measure = () => {
      const columnRoom = (element.clientWidth - G.fillPadding * 2 - G.fillGap * (columns - 1)) / columns;
      const rowRoom = (element.clientHeight - G.fillPadding * 2 - G.fillGap * (rows - 1)) / rows;
      const caption = captionWidthIn(element);
      const knobIn = (room: number) =>
        clamp(Math.round(Math.min(G.fillColumnMax, room) * G.controlShare), G.controlMin, G.controlMax);
      const stacked = knobIn(columnRoom);
      const beside = rowRoom < stacked + G.fieldTextRoom || columnRoom < caption;
      setFit({ size: beside ? knobIn(Math.min(columnRoom - G.fieldGap - caption, rowRoom)) : stacked, beside });
    };
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
    measure();
  }, [columns, rows]);
  return { grid, ...fit };
}
