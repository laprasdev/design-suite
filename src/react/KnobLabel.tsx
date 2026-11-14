import React from 'react';
import {getInsetShadow} from '../color.ts';
import {Borders, D, O, T} from '../synth/design/index.ts';
import {KnobSize} from '../synth/design/constants/KnobConfig.ts';
import type {StyleTheme} from '../synth/StyleTypes.ts';

/** A knob's label, in the knob's color: plain beside or under the knob, aligned to it, or centred on a cutout chip
 *  (smaller on a mini knob). */
export function KnobLabel({text, cutout, size, color, style, align}: {
  text: string; cutout: boolean; size: number; color: string; style: StyleTheme; align: 'left' | 'right' | 'center';
}) {
  const type = {textTransform: 'uppercase', letterSpacing: T.label.letterSpacing, color,
    fontWeight: T.label.fontWeight} as const;
  return cutout ? <div style={{...type, fontSize: size <= KnobSize.MINI ? T.small.fontSize : T.label.fontSize,
    padding: `${D.spacing.microGap}px ${D.spacing.tightGap * 1.5}px`, borderRadius: D.radius.tiny,
    background: style.cutoutBackground,
    border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
    boxShadow: getInsetShadow('shallow'), textAlign: 'center', whiteSpace: 'nowrap'}}>{text}</div>
    : <div style={{...type, fontSize: T.small.fontSize, textAlign: align, opacity: O.medium}}>{text}</div>;
}
