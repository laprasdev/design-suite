// =====================================================
// Button — composes the kit Label for its text, so every button shares one
// typographic source (no ad-hoc font/letter-spacing per button). Domain-free;
// variants are themeable. `variant`: "primary" (filled) | "ghost" (bordered) |
// "accent" (accent text) | "text" (full-strength text) | "subtle" (dim text that
// takes the accent on hover).
// `labelKind` uses any kit Label style, including compact uppercase names.
// `glow` adds the kit's gentle text glow for a call to action.
// =====================================================
import React, { type ButtonHTMLAttributes } from "react";
import { Label, type LabelKind } from "./accents.tsx";

export type ButtonVariant = "primary" | "ghost" | "accent" | "text" | "subtle";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  labelKind?: LabelKind;
  glow?: boolean;
}

export function Button({ variant = "ghost", labelKind = "action", glow = false, type = "button", className = "", children, ...rest }: ButtonProps) {
  const classes = ["bd-btn", `bd-btn--${variant}`, glow && "bd-text-glow", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} {...rest}>
      <Label kind={labelKind}>{children}</Label>
    </button>
  );
}
