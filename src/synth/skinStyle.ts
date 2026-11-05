import {hexToRgba} from '../color.ts';
import {skinPalette, flattenSkin, resolveDesignSystem, resolveSkin, type SkinJson} from '../skins.ts';
import {resolveContainerComposable, resolveComponentComposable} from './design/Composable.ts';
import type {StyleTheme} from './StyleContext.tsx';

type Palette = Record<string, unknown>;
interface CutoutShadow { inset: number[][]; highlight: number[]; highlightColor?: string }
const CONTAINER_TYPES = ['module', 'cutout'];
const WHITE = '#ffffff';

const baseOf = (skin: SkinJson) => ((skin.forms as SkinJson).base as SkinJson);

function cutoutShadowCss({inset, highlight, highlightColor = WHITE}: CutoutShadow): string {
  const px = (x: number, y: number, blur: number) => `${x}px ${y}px ${blur}px`;
  const insets = inset.map(([x, y, blur, alpha]) => `inset ${px(x, y, blur)} rgba(0, 0, 0, ${alpha})`);
  const [x, y, blur, alpha] = highlight;
  return [...insets, `${px(x, y, blur)} ${hexToRgba(highlightColor, alpha)}`].join(', ');
}

/** The web's flat view of a skin. A skin's missing colors come from the default skin. */
export function skinStyle(name: string, paletteOnly = false): StyleTheme {
  const design = resolveDesignSystem(name, paletteOnly), flat = flattenSkin(design);
  const palette: Palette = skinPalette(name);
  const color = (key: string) => palette[key] as string;
  const shadow = (baseOf(design).shadow as {cutout: CutoutShadow}).cutout;
  return {
    name: ((resolveSkin(name).meta as {label?: string}).label) ?? name,
    containers: Object.fromEntries(CONTAINER_TYPES.map(type => [type, resolveContainerComposable(flat, type)])),
    components: {'knob.inner': resolveComponentComposable(flat, 'knob.inner')},
    primaryColor: color('primary'),
    secondaryColor: color('secondary'),
    tertiaryColor: color('tertiary'),
    accentColor: color('primary'),
    backgroundColor: color('background'),
    backgroundGradientStart: color('backgroundGradient'),
    backgroundGradientEnd: color('backgroundGradient'),
    textColor: color('text'),
    borderColor: color('border'),
    glowColor: color('glow'),
    inactiveColor: color('inactive'),
    cutoutBackground: color('cutoutBackground'),
    cutoutBorder: color('cutoutBorder'),
    isFlat: false,
    shadowStyle: cutoutShadowCss(shadow),
    knobGradient: palette.knobGradient as string[],
  };
}
