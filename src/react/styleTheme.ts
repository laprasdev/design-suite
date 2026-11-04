import type { CSSProperties } from 'react';
import { useStyle } from '../synth/StyleContext.tsx';
import { hexToRgba } from '../color.ts';
import { createTheme, themeVariables } from '../theme.ts';
import { O } from '../synth/design/index.ts';

/**
 * The custom properties a SegmentedControl reads, from the synth's own style, so the control wears the module around
 * it without the host loading a theme. Put it on the control or on a wrapper around it.
 */
export function useStyleThemeVariables(): CSSProperties {
  const { textColor, cutoutBackground, primaryColor } = useStyle().getEffectiveStyle();
  const dim = hexToRgba(textColor, O.high), faint = hexToRgba(textColor, O.low);
  const colors = { bg: cutoutBackground, text: textColor, accent: primaryColor, dim, faint };
  return themeVariables(createTheme({ colors }));
}
