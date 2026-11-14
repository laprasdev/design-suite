import type { StyleTheme } from './synth/StyleTypes.ts';

export type ColorType = 'primary' | 'secondary' | 'tertiary';

export interface ColorScheme {
  main: string;
  glow: string;
  inner: string;
  fill: string;
  gradient1: string;
  gradient2: string;
}

export function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getColorScheme(colorType: ColorType, style: StyleTheme): ColorScheme {
  const colorMap: Record<ColorType, string> = {
    primary: style.primaryColor,
    secondary: style.secondaryColor,
    tertiary: '#4de88d'
  };
  const main = colorMap[colorType];
  return {
    main,
    glow: hexToRgba(main, 0.6),
    inner: hexToRgba(main, 0.15),
    fill: hexToRgba(main, 0.4),
    gradient1: hexToRgba(main, 0.6),
    gradient2: hexToRgba(main, 0.05)
  };
}

export function mapLegacyColor(color: 'cyan' | 'pink' | 'green'): ColorType {
  const map: Record<string, ColorType> = { cyan: 'primary', pink: 'secondary', green: 'tertiary' };
  return map[color];
}

// Unified color resolver - handles both ColorType and legacy color names
export type AnyColor = ColorType | 'cyan' | 'pink' | 'green';
export function resolveColorType(color: AnyColor | undefined, defaultColor: ColorType = 'primary'): ColorType {
  if (!color) return defaultColor;
  if (['primary', 'secondary', 'tertiary'].includes(color)) return color as ColorType;
  return mapLegacyColor(color as 'cyan' | 'pink' | 'green');
}

export function getGlowShadow(color: string, intensity: number = 1): string {
  const glowRgba = hexToRgba(color, 0.6 * intensity);
  const solidRgba = hexToRgba(color, 0.8 * intensity);
  return `0 0 ${12 * intensity}px ${glowRgba}, 0 0 ${4 * intensity}px ${solidRgba}`;
}

export function getInsetShadow(depth: 'shallow' | 'medium' | 'deep' = 'medium'): string {
  const depths = {
    shallow: 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
    medium: 'inset 0 2px 4px rgba(0, 0, 0, 0.6)',
    deep: 'inset 0 2px 4px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(0, 0, 0, 0.8)'
  };
  return depths[depth];
}

export function getKnobGradient(style: Pick<StyleTheme, 'knobGradient'>): string {
  const start = style.knobGradient[0];
  return `radial-gradient(circle at 30% 30%, ${start} 0%, ${hexToRgba(start, 0.8)} 40%, ${style.knobGradient.at(-1)} 100%)`;
}

export function getBooleanStyles(isActive: boolean, scheme: ColorScheme, style: StyleTheme) {
  if (isActive) {
    return {
      background: `linear-gradient(135deg, ${scheme.main} 0%, ${hexToRgba(scheme.main, 0.85)} 100%)`,
      boxShadow: `${getGlowShadow(scheme.main)}, inset 0 1px 2px rgba(255, 255, 255, 0.3)`,
      border: `1px solid ${hexToRgba(scheme.main, 0.6)}`
    };
  }
  return {
    background: style.cutoutBorder,
    boxShadow: getInsetShadow('deep'),
    border: '1px solid rgba(0, 0, 0, 0.4)'
  };
}

// --- Palette Derivation (complement + tertiary from primary) ---

export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [0, 0, 0.5];
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Derive N evenly-spaced hue variants from a primary hex color. */
export function derivePalette(primaryHex: string, count: number): string[] {
  const [h, s, l] = hexToHsl(primaryHex);
  const step = 360 / (count + 1);
  return Array.from({ length: count }, (_, i) => {
    const hue = h + step * (i + 1);
    return hslToHex(hue, s, l);
  });
}

/** Darken a hex color by mixing toward black. amount=0.2 → 20% darker. */
export function darken(hex: string, amount: number = 0.2): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const rgb = [m[1], m[2], m[3]].map(c => Math.round(parseInt(c, 16) * (1 - amount)));
  return `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Derive N group colors with bright/dark variant pairs from primary. */
export function derivePairedPalette(primary: string, groupCount: number, darkAmount = 0.2): [string, string][] {
  return derivePalette(primary, groupCount).map(c => [c, darken(c, darkAmount)]);
}

export type GridDistance = '1/8' | '1/4' | '1/3' | '1/2';

export const GRID_DIVISIONS: Record<GridDistance, number> = {
  '1/8': 8,
  '1/4': 4,
  '1/3': 3,
  '1/2': 2
};

export function getGridDivisions(distance: GridDistance): number {
  return GRID_DIVISIONS[distance] ?? 4;
}

export function getGridSpacing(distance: GridDistance, dimension: number): number {
  return dimension / getGridDivisions(distance);
}

// --- Float RGBA (Unity color format: 0-1 range) ---

export type FloatRGBA = { r: number; g: number; b: number; a: number };

export function floatRgbaToCSS(c: FloatRGBA): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a})`;
}

export function floatRgbToHex(c: FloatRGBA): string {
  const to8 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${to8(c.r)}${to8(c.g)}${to8(c.b)}`;
}

export function hexToFloatRgba(hex: string, a: number = 1): FloatRGBA | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return null;
  const parse = (i: number) => parseInt(m[1].slice(i, i + 2), 16) / 255;
  return { r: parse(0), g: parse(2), b: parse(4), a };
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max, d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (d === 0) return [0, s, v];
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, v];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 60;
  const i = Math.floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const rgb: [number, number, number][] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]];
  return rgb[i % 6];
}
