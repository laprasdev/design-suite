// The cutout a module's typed inputs and lists are drawn in, written once for all of them.
import type React from 'react';
import { hexToRgba } from '../../color.ts';
import { Borders } from '../../tokens.ts';
import { D, O } from '../../synth/design/index.ts';
import type { StyleTheme } from '../../synth/StyleContext.tsx';

// A list or number that can't be changed fades less than a dim field around it, so the two together still read.
const LOCKED_INPUT = O.high;

/** The cutout's box: its text colour, ground, edge, corners and padding. */
export const cutoutBox = (style: StyleTheme): React.CSSProperties => ({
  color: style.textColor, background: style.cutoutBackground,
  border: `${Borders.standard.width}px ${Borders.standard.style} ${hexToRgba(style.primaryColor, O.low)}`,
  borderRadius: D.radius.button, padding: D.moduleGrid.inputPadding,
});

/** How strongly an input reads: fully, or a little faded where it can't be changed. */
export const inputOpacity = (disabled: boolean | undefined) => (disabled ? LOCKED_INPUT : O.full);
