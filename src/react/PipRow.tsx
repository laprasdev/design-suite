// =====================================================
// PipRow — a generic discrete segmented meter: a value on a 0..max scale drawn
// as N pips, `filled` of them "on". Domain-free — the consumer supplies the
// value, the scale, the pip count, and the fill color. A null value reads empty.
// (Backyard-style ratings and, later, the Showdown chart both compose from this.)
// =====================================================
import React, { type HTMLAttributes } from "react";

export interface PipRowProps extends HTMLAttributes<HTMLSpanElement> {
  value: number | null | undefined;
  max?: number;
  segments?: number;
  color?: string;
}

export function PipRow({
  value,
  max = 100,
  segments = 10,
  color,
  className = "",
  ...rest
}: PipRowProps) {
  const has = value != null && !Number.isNaN(value);
  const filled = has
    ? Math.max(0, Math.min(segments, Math.round((value / max) * segments)))
    : 0;
  return (
    <span
      className={`bd-piprow${className ? " " + className : ""}`}
      role="meter"
      aria-valuenow={has ? value : undefined}
      aria-valuemin={0}
      aria-valuemax={max}
      {...rest}
    >
      {Array.from({ length: segments }, (_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            className="bd-pip"
            data-on={on ? "true" : "false"}
            style={on && color ? { background: color, borderColor: color } : undefined}
          />
        );
      })}
    </span>
  );
}
