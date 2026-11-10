import type { CSSProperties } from 'react';
import { useStyle } from '../synth/StyleContext.tsx';
import { hexToRgba } from '../color.ts';
import { createTheme, themeVariables } from '../theme.ts';
import { O } from '../synth/design/index.ts';

/** The `--dim` of the theme a style gives: what a caret or a quiet name is drawn in. */
export const dimColor = (textColor: string) => hexToRgba(textColor, O.high);

/**
 * The custom properties a SegmentedControl reads, from the synth's own style, so the control wears the module around
 * it without the host loading a theme. Put it on the control or on a wrapper around it.
 */
export function useStyleThemeVariables(): CSSProperties {
  const { textColor, cutoutBackground, primaryColor } = useStyle().getEffectiveStyle();
  const dim = dimColor(textColor), faint = hexToRgba(textColor, O.low);
  const colors = { bg: cutoutBackground, text: textColor, accent: primaryColor, dim, faint };
  // A local palette supplies colours; typography continues to come from the page's theme source.
  return Object.fromEntries(Object.entries(themeVariables(createTheme({colors}))).filter(([key]) =>
    !key.startsWith('--font') && !key.startsWith('--type') && key !== '--leading-body'));
}
