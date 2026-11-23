import { useCallback, useRef, useState } from 'react';
import { D } from '../../synth/design/index.ts';
import { zoomOf } from '../cssZoom.ts';
import { filledControlFit, type CaptionRoom, type FilledControlFit } from './filledControlFit.ts';

const G = D.moduleGrid;
/** What a field writes beside or beneath its control: its name and its reading. */
export const CAPTION_SELECTOR = '[data-field-name], [data-field-value]';

const fieldCaptionRoom = (field: Element, zoom: number): CaptionRoom => {
  const widths = [...field.querySelectorAll(CAPTION_SELECTOR)]
    .map(piece => piece.getBoundingClientRect().width / zoom);
  return {
    stacked: Math.max(0, ...widths),
    beside: widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * G.fieldGap,
  };
};

/** The widest stacked piece and widest beside sum across the grid's fields, in CSS pixels. */
const captionRoomIn = (element: HTMLElement): CaptionRoom => {
  const zoom = zoomOf(element);
  const rooms = [...element.querySelectorAll('[data-module-field]')]
    .map(field => fieldCaptionRoom(field, zoom));
  return {
    stacked: Math.max(0, ...rooms.map(room => room.stacked)),
    beside: Math.max(0, ...rooms.map(room => room.beside)),
  };
};

/** Measures a filled grid's inner box and captions, applying `filledControlFit` as the grid resizes. */
export function useFilledControlSize(columns: number, rows: number) {
  const [fit, setFit] = useState<FilledControlFit>({ size: G.controlMin, beside: true });
  const observer = useRef<ResizeObserver | null>(null);
  const grid = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    const measure = () => setFit(filledControlFit(
      element.clientWidth, element.clientHeight, columns, rows, captionRoomIn(element),
    ));
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
    measure();
  }, [columns, rows]);
  return { grid, ...fit };
}
