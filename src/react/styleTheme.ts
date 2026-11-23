import type { CSSProperties } from 'react';
import { useStyle, type StyleTheme } from '../synth/StyleContext.tsx';
import { hexToRgba } from '../color.ts';
import { createTheme, themeVariables } from '../theme.ts';
import { O } from '../synth/design/index.ts';

/** The `--dim` of the theme a style gives: what a caret or a quiet name is drawn in. */
export const dimColor = (textColor: string) => hexToRgba(textColor, O.high);

/** The custom properties suite controls read, derived from a synth style without loading a page theme. */
export function styleThemeVariables(
  { textColor, cutoutBackground, primaryColor }: Pick<StyleTheme, 'textColor' | 'cutoutBackground' | 'primaryColor'>,
): CSSProperties {
  const dim = dimColor(textColor), faint = hexToRgba(textColor, O.low);
  const colors = { bg: cutoutBackground, text: textColor, accent: primaryColor, dim, faint };
  // A local palette supplies colours; typography continues to come from the page's theme source.
  return Object.fromEntries(Object.entries(themeVariables(createTheme({colors}))).filter(([key]) =>
    !key.startsWith('--font') && !key.startsWith('--type') && key !== '--leading-body'));
}

/**
 * The custom properties a SegmentedControl reads, from the synth's own style, so the control wears the module around
 * it without the host loading a theme. Put it on the control or on a wrapper around it.
 */
export function useStyleThemeVariables(): CSSProperties {
  return styleThemeVariables(useStyle().getEffectiveStyle());
}
