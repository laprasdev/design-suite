import { Shadows, Typography } from "./tokens.ts";
import { LayoutDimensions, PHI } from "./layout.ts";
// =====================================================
// THEME — the generic aesthetic structure. `createTheme` normalizes a partial
// spec into a full semantic token set (consumers override only what they need).
// The defaults ARE the shared dark/pink "node-editor" look; an app makes "one
// theme" here and maps it onto whatever CSS variables its stylesheets use.
// =====================================================

import { hexToRgba } from "./color.ts";
import { DISPLAY_FONT_FAMILY, READING_FONT_FAMILY } from "./fonts.ts";

// A theme's overrides: its name, colors, radii, stroke and inset.
export const THEME_TYPOGRAPHY = Object.freeze({
  reading: `"${READING_FONT_FAMILY}",-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif`,
  chrome: `"${DISPLAY_FONT_FAMILY}",-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif`,
  code: 'ui-monospace,"SF Mono",Menlo,monospace',
  bodySize: 15, controlSize: 13, lineHeight: 1.6,
  headingSize:20, subheadingSize:17, titleSize:15, captionSize:Typography.caption.fontSize, codeSize:13,
  titleLeading:1.4, codeLeading:1.5, capsTracking:".1em", wideTracking:".12em",
});
export type ThemeTypography = { [K in keyof typeof THEME_TYPOGRAPHY]:
  typeof THEME_TYPOGRAPHY[K] extends number ? number : string };
type NumericTypographyKey =
  { [K in keyof ThemeTypography]: ThemeTypography[K] extends number ? K : never }[keyof ThemeTypography];
// Every text size a theme publishes, as the custom property that carries it and the typography key that holds it.
export const TEXT_SIZE_VARIABLES = Object.freeze({
  "--type-body": "bodySize", "--type-control": "controlSize", "--type-heading": "headingSize",
  "--type-subheading": "subheadingSize", "--type-title": "titleSize", "--type-caption": "captionSize",
  "--type-meta": "controlSize", "--type-answer": "controlSize", "--type-code": "codeSize",
} as const satisfies Record<`--type-${string}`, NumericTypographyKey>);
// The Label's kinds (widgets.css `.bd-label--<kind>`), each drawn in its typography role: one size, the role's
// weight and tracking, so a header is the same text given its heavier role.
const LABEL_KIND_ROLES = Object.freeze({
  name: "caption", value: "value", action: "label", chosen: "chosen",
} as const satisfies Record<string, keyof typeof Typography>);
/** The type every Label kind reads, from its typography role: a host that loads no theme spreads it on its root. */
export const labelVariables = (): Record<`--label-${string}`, string> => Object.fromEntries(
  Object.entries(LABEL_KIND_ROLES).flatMap(([kind, role]) => [
    [`--label-${kind}-size`, `${Typography[role].fontSize}px`],
    [`--label-${kind}-weight`, String(Typography[role].fontWeight)],
    [`--label-${kind}-tracking`, Typography[role].letterSpacing]]));
export interface ThemeSpec {
  typography?: Partial<ThemeTypography>;
  name?: string;
  colors?: Partial<Record<"bg" | "stage" | "surface" | "surfaceHi" | "line" | "bevel" | "text" | "dim" | "faint"
    | "accent" | "accentDeep" | "accentWash" | "codeWash" | "teal" | "amber" | "gold" | "goldLight" | "grass" | "sand"
    | "scarlet", string>>;
  radius?: { lg?: number; sm?: number };
  stroke?: { line?: number };
  space?: { inset?: number };
}
// A wash is its colour at this alpha: faint enough that text on it keeps its contrast.
export const WASH_ALPHA = 0.11;
export function createTheme(spec: ThemeSpec = {}) {
  const c = spec.colors || {};
  const accent = c.accent || "#c4678f", text = c.text || "#f0f0f3";
  return {
    name: spec.name || "bloom-dark",
    typography: {...THEME_TYPOGRAPHY, ...spec.typography},
    colors: {
      bg: c.bg || "#151515",
      stage: c.stage || "#0d0d11",
      surface: c.surface || "#15151a",
      surfaceHi: c.surfaceHi || "#1c1c22",
      line: c.line || "rgba(255,255,255,0.11)",
      bevel: c.bevel || "rgba(255,255,255,0.05)",
      text,
      dim: c.dim || "#82828e",
      faint: c.faint || "#55555f",
      accent,
      accentDeep: c.accentDeep || "#7d3f5b",
      accentWash: c.accentWash || hexToRgba(accent, WASH_ALPHA),
      // Behind a code span or block.
      codeWash: c.codeWash || hexToRgba(text, WASH_ALPHA),
      teal: c.teal || "#4ecfc6",
      amber: c.amber || "#e2a659",
      // Trophy gold, and the brighter gold of its glow.
      gold: c.gold || "#dfbb7a",
      goldLight: c.goldLight || "#ffd978",
      // Field grass and the infield's sand, drawn faintly like the amber mound.
      grass: c.grass || "#9cf08a",
      sand: c.sand || "#ecd2a2",
      // Salmon scarlet, warm beside the accent and amber: what waits on a person.
      scarlet: c.scarlet || "#e86f5f",
    },
    radius: { lg: spec.radius?.lg ?? 14, sm: spec.radius?.sm ?? 9 },
    // Border width for section and control outlines, in px.
    stroke: { line: spec.stroke?.line ?? 1.5 },
    space: { inset: spec.space?.inset ?? 22 },
  };
}

// Fired when a host swaps its palette, so controls that measure themselves can redraw.
export const PALETTE_CHANGE_EVENT = "palette-change";
export type Theme = ReturnType<typeof createTheme>;
type ThemeColor = keyof Theme["colors"];
type ColorVariable = `--color-${string}`;
const colorVariable = (name: string): ColorVariable =>
  `--color-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
// The colours themeVariables publishes as --color-*; the shared desk's "Theme colours" to-do publishes the rest.
const APPLIED_COLORS = Object.freeze(
  ["surface", "surfaceHi", "line", "text", "dim", "accent", "accentDeep"] as const satisfies readonly ThemeColor[]);

// Every colour of a theme as its --color-<kebab-case name> custom property.
export function colorVariables(t: Theme): Record<ColorVariable, string> {
  return Object.fromEntries(Object.entries(t.colors).map(([name, color]) => [colorVariable(name), color]));
}

// The custom properties the composed controls read, from one theme.
export function themeVariables(t: Theme): Record<string, string> {
  const c = t.colors, type = t.typography ?? THEME_TYPOGRAPHY;
  return {
    "--phi": String(PHI),
    "--font": type.reading, "--font-reading": type.reading, "--font-chrome": type.chrome,
    "--font-code": type.code,
    ...Object.fromEntries(Object.entries(TEXT_SIZE_VARIABLES).map(([name, key]) => [name, `${type[key]}px`])),
    ...labelVariables(),
    "--caption-size": `${Typography.caption.fontSize}px`,
    "--caption-tracking": Typography.caption.letterSpacing,
    "--leading-body": String(type.lineHeight),
    "--leading-title": String(type.titleLeading), "--leading-code": String(type.codeLeading),
    "--tracking-caps": type.capsTracking, "--tracking-caps-wide": type.wideTracking,
    ...Object.fromEntries(APPLIED_COLORS.map(name => [colorVariable(name), c[name]])), "--surface-chrome": c.surface,
    "--bg": c.bg, "--stage": c.stage, "--card": c.surface, "--card-hi": c.surfaceHi, "--line": c.line,
      "--bevel": c.bevel,
    "--text": c.text, "--selection-foreground": c.text, "--dim": c.dim, "--faint": c.faint,
    "--pink": c.accent, "--pink-deep": c.accentDeep, "--pink-wash": c.accentWash, "--code-wash": c.codeWash,
      "--teal": c.teal,
    "--amber": c.amber, "--gold": c.gold, "--gold-light": c.goldLight, "--grass": c.grass, "--sand": c.sand,
    "--scarlet": c.scarlet,
    "--r": `${t.radius.lg}px`, "--r-sm": `${t.radius.sm}px`, "--inset": `${t.space.inset}px`,
      "--line-width": `${t.stroke.line}px`,
    "--panel-shadow": Shadows.moduleOuter,
    "--field-gap": `${LayoutDimensions.spacing.tightGap}px`,
    "--section-gap": `${LayoutDimensions.spacing.rowGap}px`,
    "--control-hit-size": `${LayoutDimensions.sizes.buttonHeight}px`,
  };
}
export function applyTheme(t: Theme, el: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(themeVariables(t))) el.style.setProperty(name, value);
  el.dispatchEvent(new CustomEvent(PALETTE_CHANGE_EVENT, { bubbles: true }));
}

