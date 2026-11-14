// The caret of a list: CaretButton's own chevron (caretGlyph.ts), turned down, in the colour CaretButton draws it in,
// at the same inset from the right as the box's text has from the left, with room kept for it so a long label never
// runs under it. A native select draws its arrow at the browser's own inset and in its own colour, so the select takes
// `appearance: none` and this in its place.
import type React from 'react';
import type {StyleTheme} from '../../synth/StyleTypes.ts';
import {CARET_DOWN_TURN, CARET_PATH, CARET_SIZE, CARET_STROKE, CARET_VIEW} from '../caretGlyph.ts';
import {dimColor} from '../styleTheme.ts';

const CARET_CENTRE = CARET_VIEW / 2;
/** A native list sets its text on a line of this many times its size and ignores `line-height`; with `appearance:none`
 *  the line is the style's own, so it is held here and the box keeps the height it always had. */
const NATIVE_LINE = 4 / 3;

const caretImage = (color: string) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARET_VIEW} ${CARET_VIEW}" width="${CARET_SIZE}" `
  + `height="${CARET_SIZE}"><path d="${CARET_PATH}" `
  + `transform="rotate(${CARET_DOWN_TURN} ${CARET_CENTRE} ${CARET_CENTRE})" fill="none" `
  + `stroke="${color}" stroke-width="${CARET_STROKE}" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}")`;

/** `inset` is the padding the text keeps from the box's left edge; the caret keeps the same from the right. */
export const selectCaret = (style: StyleTheme, inset: number): React.CSSProperties => ({
  appearance: 'none', WebkitAppearance: 'none', lineHeight: NATIVE_LINE,
  backgroundImage: caretImage(dimColor(style.textColor)),
  backgroundRepeat: 'no-repeat', backgroundPosition: `right ${inset}px center`,
  backgroundSize: `${CARET_SIZE}px ${CARET_SIZE}px`, paddingRight: inset * 2 + CARET_SIZE,
});
