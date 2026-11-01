// =====================================================
// ACCENTS — the small building blocks widgets compose from, matching Bloom's
// AccentKind (NameLabel, ValueLabel, Glyph, Divider, LightBox). Domain-free.
// =====================================================
import React, { type HTMLAttributes, type ReactNode } from "react";

export type LabelKind = "name" | "value" | "action";

/** A text accent. kind: "name" (field name, uppercase/dim) | "value" (current
 *  value, preserves case, brighter). */
export function Label({ kind = "name", children, className = "", ...rest }: HTMLAttributes<HTMLSpanElement> & { kind?: LabelKind }) {
  return (
    <span className={`bd-label bd-label--${kind}${className ? " " + className : ""}`} {...rest}>
      {children}
    </span>
  );
}

/** An icon/glyph slot. Pass an <svg>, character, or image as children. */
export function Glyph({ children, size = 14, className = "", ...rest }: HTMLAttributes<HTMLSpanElement> & { size?: number }) {
  return (
    <span
      className={`bd-glyph${className ? " " + className : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </span>
  );
}

/** A thin divider between accents. */
export function Divider({ vertical = false, className = "" }: { vertical?: boolean; className?: string }) {
  return (
    <span
      className={`bd-divider${vertical ? " bd-divider--v" : ""}${className ? " " + className : ""}`}
      aria-hidden="true"
    />
  );
}

/** A bordered box that frames a glyph/value (AccentKind.LightBox). */
export function LightBox({ children, className = "", ...rest }: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode }) {
  return (
    <span className={`bd-lightbox${className ? " " + className : ""}`} {...rest}>
      {children}
    </span>
  );
}
