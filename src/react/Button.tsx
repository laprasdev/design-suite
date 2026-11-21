// =====================================================
// Button — composes the kit Label for its text, so every button shares one
// typographic source (no ad-hoc font/letter-spacing per button). Domain-free;
// variants are themeable. `variant`: "primary" (filled) | "ghost" (bordered) |
// "accent" (accent text) | "text" (full-strength text) | "subtle" (dim text that
// takes the accent on hover). `pending` shows the loading Poké Ball sized to the
// text beside the label, marks the button busy, keeps focus, and ignores presses.
// =====================================================
import React, { type ButtonHTMLAttributes } from "react";
import { Label, type LabelKind } from "./accents.tsx";
import { pendingStatus } from "./segmentPending.tsx";

export type ButtonVariant = "primary" | "ghost" | "accent" | "text" | "subtle" | "navigation";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  labelKind?: LabelKind | "none";
  glow?: boolean;
  pending?: boolean;
}

export function Button({ variant = "ghost", labelKind = "action", glow = false, pending = false,
  type = "button", className = "", disabled, onClick, children, ...rest }: ButtonProps) {
  const classes = ["bd-btn", `bd-btn--${variant}`, glow && "bd-text-glow", className].filter(Boolean).join(" ");
  const content = pending ? pendingStatus(children) : children;
  return (
    <button type={type} className={classes} disabled={disabled}
      data-pending={pending || undefined} aria-busy={pending || undefined}
      onClick={disabled || pending ? undefined : onClick} {...rest}>
      {labelKind === "none" ? content : <Label kind={labelKind}>{content}</Label>}
    </button>
  );
}
