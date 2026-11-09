// =====================================================
// CaretButton — the small disclosure caret: one button that folds and unfolds
// whatever region it heads. Rotates to point along the open edge, and
// aria-expanded carries the state. Domain-free; the consumer owns the region
// it reveals and keeps the title visible beside it.
// =====================================================
import React, { type ButtonHTMLAttributes } from "react";
import { CARET_PATH, CARET_SIZE, CARET_STROKE, CARET_VIEW } from "./caretGlyph.ts";

export interface CaretButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  open: boolean;
  label: string;
}

export function CaretButton({ open, label, className = "", ...rest }: CaretButtonProps) {
  return (
    <button
      type="button"
      className={`bd-caret${className ? " " + className : ""}`}
      aria-expanded={open}
      aria-label={label}
      {...rest}
    >
      <svg viewBox={`0 0 ${CARET_VIEW} ${CARET_VIEW}`} width={CARET_SIZE} height={CARET_SIZE} aria-hidden="true">
        <path d={CARET_PATH} fill="none" stroke="currentColor" strokeWidth={CARET_STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
