// CAPTION WIDTHS — measures a single-line run's width from a generated font-metrics table, with no font parser and no
// consumer font in this package.
import { Typography } from './tokens.ts';

/** One weight cut's horizontal metrics in font design units: glyph advances by character and pair kerning by pair. */
export interface FontCutMetrics {
  readonly unitsPerEm: number;
  readonly advances: Readonly<Record<string, number>>;
  readonly kerning: Readonly<Record<string, number>>;
}

/** Metrics keyed by CSS font-weight (for example `"600"` for `Typography.label`). */
export interface CaptionWidthTable {
  readonly cuts: Readonly<Record<string, FontCutMetrics>>;
}

/** The typographic properties that determine a single-line text run's width. */
export interface TextRunStyle {
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly letterSpacing: string;
  readonly uppercase?: boolean;
}

const EM_SUFFIX = 'em';

function letterSpacingEm(spacing: string): number {
  if (!spacing.endsWith(EM_SUFFIX)) {
    throw new Error(`Expected letterSpacing in "${EM_SUFFIX}", given "${spacing}".`);
  }
  const parsed = Number(spacing.slice(0, -EM_SUFFIX.length));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected finite letterSpacing in "${EM_SUFFIX}", given "${spacing}".`);
  }
  return parsed;
}

/** Width in CSS pixels of `text` drawn on one line in `style`, read from `table`. */
export function textRunWidth(text: string, style: TextRunStyle, table: CaptionWidthTable): number {
  const weight = String(style.fontWeight);
  const cut = Object.hasOwn(table.cuts, weight) ? table.cuts[weight] : undefined;
  if (!cut) throw new Error(`Caption width table has no cut for weight ${weight}.`);
  const transformed = style.uppercase ? text.toUpperCase() : text;
  const chars = [...transformed];
  if (chars.length === 0) return 0;
  let units = 0;
  for (let index = 0; index < chars.length; index++) {
    const ch = chars[index];
    const advance = Object.hasOwn(cut.advances, ch) ? cut.advances[ch] : undefined;
    if (advance === undefined) {
      throw new Error(`Caption width table cut ${weight} has no advance for "${ch}".`);
    }
    units += advance;
    if (index + 1 < chars.length) {
      const pair = ch + chars[index + 1];
      units += Object.hasOwn(cut.kerning, pair) ? cut.kerning[pair] : 0;
    }
  }
  const spacingPx = letterSpacingEm(style.letterSpacing) * style.fontSize;
  return (units / cut.unitsPerEm) * style.fontSize + chars.length * spacingPx;
}

/** Width in CSS pixels of an uppercase `Typography.label` caption drawn on one line, read from `table`. */
export const captionWidth = (text: string, table: CaptionWidthTable): number =>
  textRunWidth(text, { ...Typography.label, uppercase: true }, table);
