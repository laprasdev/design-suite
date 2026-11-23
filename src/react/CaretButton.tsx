// =====================================================
// CaretButton — the small disclosure caret: one button that folds and unfolds
// whatever region it heads. Rotates to point along the open edge, and
// aria-expanded carries the state. Domain-free; the consumer owns the region
// it reveals and keeps the title visible beside it.
// =====================================================
import React, { type ReactNode, type ButtonHTMLAttributes } from "react";
import { CARET_TURN, CaretGlyph } from "./caretGlyph.tsx";

export interface CaretButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  open: boolean;
  label: string;
  children?: ReactNode;
}

export function CaretButton({ open, label, className = "", children, ...rest }: CaretButtonProps) {
  return (
    <button
      type="button"
      className={`bd-caret${className ? " " + className : ""}`}
      data-labelled={children !== undefined || undefined}
      aria-expanded={open}
      aria-label={label}
      {...rest}
    >
      <CaretGlyph turn={CARET_TURN.right} />
      {children}
    </button>
  );
}
