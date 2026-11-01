// =====================================================
// CaretButton — the small disclosure caret: one button that folds and unfolds
// whatever region it heads. Rotates to point along the open edge, and
// aria-expanded carries the state. Domain-free; the consumer owns the region
// it reveals and keeps the title visible beside it.
// =====================================================
import React, { type ButtonHTMLAttributes } from "react";

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
      <svg viewBox="0 0 10 10" width="7" height="7" aria-hidden="true">
        <path d="M3 1.2 L7.2 5 L3 8.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
