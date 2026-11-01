import { Shadows, Typography } from "./tokens.ts";
import { LayoutDimensions } from "./layout.ts";
// =====================================================
// THEME — the generic aesthetic structure. `createTheme` normalizes a partial
// spec into a full semantic token set (consumers override only what they need).
// The defaults ARE the shared dark/pink "node-editor" look; an app makes "one
// theme" here and maps it onto whatever CSS variables its stylesheets use.
// =====================================================

import { hexToRgba } from "./color.ts";

// A theme's overrides: its name, colors, radii, stroke and inset.
export interface ThemeSpec {
  name?: string;
  colors?: Partial<Record<"bg" | "stage" | "surface" | "surfaceHi" | "line" | "bevel" | "text" | "dim" | "faint" | "accent" | "accentDeep" | "accentWash" | "teal" | "amber" | "gold" | "goldLight" | "grass" | "sand", string>>;
  radius?: { lg?: number; sm?: number };
  stroke?: { line?: number };
  space?: { inset?: number };
}
export function createTheme(spec: ThemeSpec = {}) {
  const c = spec.colors || {};
  const accent = c.accent || "#c4678f";
  return {
    name: spec.name || "bloom-dark",
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
    },
    radius: { lg: spec.radius?.lg ?? 14, sm: spec.radius?.sm ?? 9 },
    // Border width for section and control outlines, in px.
    stroke: { line: spec.stroke?.line ?? 1.5 },
    space: { inset: spec.space?.inset ?? 22 },
  };
}

// Fired when a host swaps its palette, so controls that measure themselves can redraw.
export const PALETTE_CHANGE_EVENT = "palette-change";
type Theme = ReturnType<typeof createTheme>;
// The custom properties the composed controls read, from one theme.
export function themeVariables(t: Theme): Record<string, string> {
  const c = t.colors;
  return {
    "--bg": c.bg, "--stage": c.stage, "--card": c.surface, "--card-hi": c.surfaceHi, "--line": c.line, "--bevel": c.bevel,
    "--text": c.text, "--selection-foreground": c.text, "--dim": c.dim, "--faint": c.faint,
    "--pink": c.accent, "--pink-deep": c.accentDeep, "--pink-wash": c.accentWash, "--teal": c.teal,
    "--amber": c.amber, "--gold": c.gold, "--gold-light": c.goldLight, "--grass": c.grass, "--sand": c.sand,
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

