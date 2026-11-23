import { useCallback, useRef, useState } from 'react';
import { D } from '../../synth/design/index.ts';
import { zoomOf } from '../cssZoom.ts';
import { filledControlFit, type FilledControlFit } from './filledControlFit.ts';

export { filledControlFit, type FilledControlFit };

const G = D.moduleGrid;
/** What a field writes beside or beneath its control: its name and its reading. */
export const CAPTION_SELECTOR = '[data-field-name], [data-field-value]';

const fieldCaptionWidth = (field: Element, zoom: number) => {
  const pieces = [...field.querySelectorAll(CAPTION_SELECTOR)];
  return pieces.reduce((sum, piece) => sum + piece.getBoundingClientRect().width / zoom, 0)
    + Math.max(0, pieces.length - 1) * G.fieldGap;
};

/** The widest caption (name and reading beside it) the grid draws, in CSS pixels. */
const captionWidthIn = (element: HTMLElement) => {
  const zoom = zoomOf(element);
  return Math.max(0, ...[...element.querySelectorAll('[data-module-field]')]
    .map(field => fieldCaptionWidth(field, zoom)));
};

/** Measures a filled grid's inner box and captions, applying `filledControlFit` as the grid resizes. */
export function useFilledControlSize(columns: number, rows: number) {
  const [fit, setFit] = useState<FilledControlFit>({ size: G.controlMin, beside: true });
  const observer = useRef<ResizeObserver | null>(null);
  const grid = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    const measure = () => setFit(filledControlFit(
      element.clientWidth, element.clientHeight, columns, rows, captionWidthIn(element),
    ));
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
    measure();
  }, [columns, rows]);
  return { grid, ...fit };
}
