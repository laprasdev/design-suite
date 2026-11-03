import {hexToRgba} from '../color.ts';
import {DEFAULT_SKIN, flattenSkin, resolveDesignSystem, resolveSkin, type SkinJson} from '../skins.ts';
import {resolveContainerComposable} from './design/Composable.ts';
import type {StyleTheme} from './StyleContext.tsx';

type Palette = Record<string, unknown>;
interface CutoutShadow { inset: number[][]; highlight: number[]; highlightColor?: string }
const CONTAINER_TYPES = ['module', 'cutout'];
const WHITE = '#ffffff';

const baseOf = (skin: SkinJson) => ((skin.forms as SkinJson).base as SkinJson);

function paletteOf(name: string): Palette {
  const palette = (baseOf(resolveSkin(name)).palette ?? {}) as Palette;
  return Object.fromEntries(Object.entries(palette).filter(([, value]) => value !== null));
}

function cutoutShadowCss({inset, highlight, highlightColor = WHITE}: CutoutShadow): string {
  const px = (x: number, y: number, blur: number) => `${x}px ${y}px ${blur}px`;
  const insets = inset.map(([x, y, blur, alpha]) => `inset ${px(x, y, blur)} rgba(0, 0, 0, ${alpha})`);
  const [x, y, blur, alpha] = highlight;
  return [...insets, `${px(x, y, blur)} ${hexToRgba(highlightColor, alpha)}`].join(', ');
}

/** The web's flat view of a skin. A skin's missing colors come from the default skin. */
export function skinStyle(name: string): StyleTheme {
  const flat = flattenSkin(resolveDesignSystem(name));
  const palette: Palette = {...paletteOf(DEFAULT_SKIN), ...paletteOf(name)};
  const color = (key: string) => palette[key] as string;
  const shadow = (baseOf(resolveSkin(name)).shadow as {cutout: CutoutShadow}).cutout;
  return {
    name: ((resolveSkin(name).meta as {label?: string}).label) ?? name,
    containers: Object.fromEntries(CONTAINER_TYPES.map(type => [type, resolveContainerComposable(flat, type)])),
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
