// =====================================================
// Cycle — a compact control that cycles through options on click (Bloom's
// WidgetDisplayGuiComponent.Cycle: NameLabel + Glyph + ValueLabel in a bordered
// cell). Domain-free. `options` is [{ value, label, accent? }].
// =====================================================
import React, { type ReactNode } from "react";

export interface CycleOption<V> {
  value: V;
  label: ReactNode;
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
}
import { Label, Glyph } from "./accents.tsx";

export function Cycle<V>({ options, value, onChange, label, glyph, className = "", disabled }: CycleProps<V>) {
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const cur = options[idx] || options[0];
  const next = () => onChange(options[(idx + 1) % options.length].value);

  return (
    <button
      type="button" disabled={disabled || !options.length}
      className={`bd-cycle${className ? " " + className : ""}`}
      data-accent={cur?.accent ? "true" : "false"}
      onClick={next}
      title={label}
    >
      {glyph && <Glyph size={12}>{glyph}</Glyph>}
      {label && <Label kind="name">{label}</Label>}
      <Label kind="value" className="bd-cycle-val">
        {cur?.label}
      </Label>
    </button>
  );
}
