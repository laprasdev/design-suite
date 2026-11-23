import React from "react";

// The disclosure chevron, drawn once: CaretButton draws it pointing along its open edge, a list's field draws it turned
// down, and a native select paints the same shape as its background (selectCaret.ts). Each takes its own colour; the
// shape, size and stroke are only here.
export const CARET_VIEW = 10, CARET_SIZE = 7, CARET_STROKE = 1.7;
/** Pointing right, from the view's centre-left edge. */
export const CARET_PATH = 'M3 1.2 L7.2 5 L3 8.8';
/** Turned a quarter, so it points down from a list's box. */
export const CARET_DOWN_TURN = 90;
/** The point the shape turns about. */
export const CARET_CENTRE = CARET_VIEW / 2;

/** The shape as drawn: turned by `turn` degrees about its centre, in the colour of the text around it. */
export function CaretGlyph({ turn, className }: { turn: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${CARET_VIEW} ${CARET_VIEW}`} width={CARET_SIZE} height={CARET_SIZE} aria-hidden="true"
      className={className}>
      <path d={CARET_PATH} transform={`rotate(${turn} ${CARET_CENTRE} ${CARET_CENTRE})`} fill="none"
        stroke="currentColor" strokeWidth={CARET_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
