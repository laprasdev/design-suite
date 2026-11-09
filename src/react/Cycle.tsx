// =====================================================
// Cycle — a compact control that cycles through options on click (Bloom's
// WidgetDisplayGuiComponent.Cycle: NameLabel + Glyph + ValueLabel in a bordered
// cell). Domain-free. `options` is [{ value, label, accent? }].
// =====================================================
import React, { type ReactNode } from "react";

export interface CycleOption<V> {
  value: V;
  label: ReactNode;
  /** The option's word when its label is an icon. */
  name?: string;
  accent?: boolean;
}
export interface CycleProps<V> {
  options: readonly CycleOption<V>[];
  value: V;
  onChange(value: V): void;
  label?: string;
  glyph?: ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: "text";
  ariaLabel?: string;
}
import { Label, Glyph } from "./accents.tsx";

export function Cycle<V>({options, value, onChange, label, glyph, className = "", disabled, variant,
  ariaLabel}: CycleProps<V>) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const cur = options[idx] || options[0];
  const next = () => onChange(options[(idx + 1) % options.length].value);
  const word = cur?.name ?? cur?.label;
  if (word !== undefined && typeof word !== "string" && typeof word !== "number") {
    throw new Error(`${ariaLabel ?? label ?? "A cycle"}'s option drawn as an icon needs a name.`);
  }

  return (
    <button
      type="button" disabled={disabled || !options.length}
      className={`bd-cycle${className ? " " + className : ""}`}
      data-accent={cur?.accent ? "true" : "false"}
      onClick={next}
      title={ariaLabel ? `${ariaLabel}: ${word ?? ""}` : label}
      aria-label={ariaLabel ? `${ariaLabel}: ${word ?? ""}` : undefined}
      data-variant={variant}
    >
      {glyph && <Glyph size={12}>{glyph}</Glyph>}
      {label && <Label kind="name">{label}</Label>}
      <Label kind="value" className="bd-cycle-val">
        {cur?.label}
      </Label>
    </button>
  );
}
