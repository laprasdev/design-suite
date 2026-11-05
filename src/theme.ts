import { Shadows, Typography } from "./tokens.ts";
import { LayoutDimensions, PHI } from "./layout.ts";
// =====================================================
// THEME — the generic aesthetic structure. `createTheme` normalizes a partial
// spec into a full semantic token set (consumers override only what they need).
// The defaults ARE the shared dark/pink "node-editor" look; an app makes "one
// theme" here and maps it onto whatever CSS variables its stylesheets use.
// =====================================================

import { hexToRgba } from "./color.ts";

// A theme's overrides: its name, colors, radii, stroke and inset.
export const THEME_TYPOGRAPHY = Object.freeze({
  reading: '-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif',
  chrome: '"Bloom SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif',
  code: 'ui-monospace,"SF Mono",Menlo,monospace',
  bodySize: 15, controlSize: 13, lineHeight: 1.6,
});
export type ThemeTypography = { [K in keyof typeof THEME_TYPOGRAPHY]:
  typeof THEME_TYPOGRAPHY[K] extends number ? number : string };
export interface ThemeSpec {
  typography?: Partial<ThemeTypography>;
  name?: string;
  colors?: Partial<Record<"bg" | "stage" | "surface" | "surfaceHi" | "line" | "bevel" | "text" | "dim" | "faint" | "accent" | "accentDeep" | "accentWash" | "teal" | "amber" | "gold" | "goldLight" | "grass" | "sand" | "scarlet", string>>;
  radius?: { lg?: number; sm?: number };
  stroke?: { line?: number };
  space?: { inset?: number };
}
export function createTheme(spec: ThemeSpec = {}) {
  const c = spec.colors || {};
  const accent = c.accent || "#c4678f";
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
      text: c.text || "#f0f0f3",
      dim: c.dim || "#82828e",
      faint: c.faint || "#55555f",
      accent,
      accentDeep: c.accentDeep || "#7d3f5b",
      accentWash: c.accentWash || hexToRgba(accent, 0.11),
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
// The custom properties the composed controls read, from one theme.
export function themeVariables(t: Theme): Record<string, string> {
  const c = t.colors, type = t.typography ?? THEME_TYPOGRAPHY;
  return {
    "--phi": String(PHI),
    "--font": type.reading, "--font-reading": type.reading, "--font-chrome": type.chrome,
    "--font-code": type.code, "--type-body": `${type.bodySize}px`, "--type-control": `${type.controlSize}px`,
    "--leading-body": String(type.lineHeight),
    "--color-surface": c.surface, "--color-surface-hi": c.surfaceHi, "--color-line": c.line,
    "--color-text": c.text, "--color-dim": c.dim, "--color-accent": c.accent,
    "--color-accent-deep": c.accentDeep, "--surface-chrome": c.surface,
    "--bg": c.bg, "--stage": c.stage, "--card": c.surface, "--card-hi": c.surfaceHi, "--line": c.line, "--bevel": c.bevel,
    "--text": c.text, "--selection-foreground": c.text, "--dim": c.dim, "--faint": c.faint,
    "--pink": c.accent, "--pink-deep": c.accentDeep, "--pink-wash": c.accentWash, "--teal": c.teal,
    "--amber": c.amber, "--gold": c.gold, "--gold-light": c.goldLight, "--grass": c.grass, "--sand": c.sand,
    "--scarlet": c.scarlet,
    "--r": `${t.radius.lg}px`, "--r-sm": `${t.radius.sm}px`, "--inset": `${t.space.inset}px`, "--line-width": `${t.stroke.line}px`,
    "--panel-shadow": Shadows.moduleOuter,
    "--field-gap": `${LayoutDimensions.spacing.tightGap}px`,
    "--section-gap": `${LayoutDimensions.spacing.rowGap}px`,
    "--control-hit-size": `${LayoutDimensions.sizes.buttonHeight}px`,
    "--caption-size": `${Typography.caption.fontSize}px`,
    "--caption-tracking": String(Typography.caption.letterSpacing),
  };
}
export function applyTheme(t: Theme, el: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(themeVariables(t))) el.style.setProperty(name, value);
  el.dispatchEvent(new CustomEvent(PALETTE_CHANGE_EVENT, { bubbles: true }));
}

