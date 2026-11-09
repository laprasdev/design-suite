// =====================================================
// PipRow — a generic discrete segmented meter: a value on a 0..max scale drawn
// as N pips, `filled` of them "on". Domain-free — the consumer supplies the
// value, the scale, the pip count, and the fill color. A null value reads empty.
// (Backyard-style ratings and, later, the Showdown chart both compose from this.)
// =====================================================
import React, { type HTMLAttributes } from "react";

/** The meter spreads its pips across the row it fills. Compact gives each pip a fixed width and the row only the width
 * of its pips, for a small count beside a title. */
export const PipRowForm = Object.freeze({ METER: "meter", COMPACT: "compact" } as const);
export type PipRowFormValue = typeof PipRowForm[keyof typeof PipRowForm];

export interface PipRowProps extends HTMLAttributes<HTMLSpanElement> {
  value: number | null | undefined;
  max?: number;
  segments?: number;
  color?: string;
  form?: PipRowFormValue;
}

export function PipRow({
  value,
  max = 100,
  segments = 10,
  color,
  form = PipRowForm.METER,
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
      data-form={form === PipRowForm.METER ? undefined : form}
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
