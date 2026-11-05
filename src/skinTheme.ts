import {createTheme} from './theme.ts';
import {skinPalette, resolveDesignSystem, type SkinJson} from './skins.ts';

/** The CSS theme projection of the canonical skin data, shared by every host. */
export function createSkinTheme(name: string, paletteOnly = false) {
  const base = (resolveDesignSystem(name, paletteOnly).forms as SkinJson).base as SkinJson;
  const palette = skinPalette(name) as Record<string, string>;
  const radius = (base.contentShape as {cornerRadius?: number})?.cornerRadius;
  return createTheme({name, radius: radius === undefined ? undefined : {lg: radius, sm: radius * 0.75},
    colors: {
      accent: palette.primary, teal: palette.secondary, bg: palette.background, stage: palette.background,
      surface: palette.cutoutBackground, surfaceHi: palette.backgroundGradient,
      line: palette.border, text: palette.text,
    },
  });
}
