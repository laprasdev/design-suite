// =====================================================
// Button — composes the kit Label for its text, so every button shares one
// typographic source (no ad-hoc font/letter-spacing per button). Domain-free;
// variants are themeable. `variant`: "primary" (filled) | "ghost" (bordered) |
// "accent" (accent text) | "text" (full-strength text) | "subtle" (dim text that
// takes the accent on hover).
// `labelKind` uses any kit Label style, including compact uppercase names.
// `glow` adds the kit's gentle text glow for a call to action.
// `pending` is the suite's pending form (pending.tsx): it replaces `disabled`
// while the consumer saves the press.
// =====================================================
import React from "react";
import { Label, type LabelKind } from "./accents.tsx";
import { pendingContent, pendingPress, type PendingButtonAttributes } from "./pending.tsx";
import { PendingForm } from "./pendingElements.ts";

export type ButtonVariant = "primary" | "ghost" | "accent" | "text" | "subtle" | "navigation";
export interface ButtonProps extends PendingButtonAttributes {
  variant?: ButtonVariant;
  labelKind?: LabelKind | "none";
  glow?: boolean;
  pending?: boolean;
}

export function Button({ variant = "ghost", labelKind = "action", glow = false, pending = false,
  type = "button", className = "", onClick, children, ...rest }: ButtonProps) {
  const classes = ["bd-btn", `bd-btn--${variant}`, glow && "bd-text-glow", className].filter(Boolean).join(" ");
  const content = pendingContent({ pending, form: PendingForm.TEXT, content: children });
  return (
    <button {...rest} type={type} className={classes} {...pendingPress(pending, onClick)}>
      {labelKind === "none" ? content : <Label kind={labelKind}>{content}</Label>}
    </button>
  );
}
