import type { MutableRefObject } from 'react';

/**
 * The wrapping grid form's inputs. `cell` is the smallest square a column is measured against, which also keeps the
 * frame no shorter than its rows of it; `glyphShare` is the share of the cell its columns and rows give that the glyph
 * takes; `columns` is how many the frame's width holds, measured by the consumer and undefined until it is. `frame`
 * hands the control's own root to that consumer.
 */
export interface WrapGrid {
  cell: number; glyphShare: number; columns?: number;
  frame: MutableRefObject<HTMLDivElement | null>;
}

/** The CSS variables segmented-control.css's wrap rules read; this is their one writer. */
export function wrapVariables({ cell, glyphShare, columns }: WrapGrid, count: number) {
  return {
    '--segment-cell': `${cell}px`, '--segment-glyph-share': glyphShare,
    ...(columns && { '--segment-columns': columns, '--segment-rows': Math.ceil(count / columns) }),
  };
}

/**
 * What the pictured forms take beside `wrap` and `cell`. `glyphShare`: with `cell`, the icon's slot is this share
 * of the cell, so an icon sized to fill takes it. `onPoint` reports the option the pointer or focus is on, and null
 * when it leaves, for a hint that names it; a control that reports keeps its options aria-disabled rather than
 * disabled when it can't be changed, so they still take the pointer.
 */
export interface Pictured<V> {
  glyphShare?: number;
  onPoint?: (value: V | null) => void;
}
