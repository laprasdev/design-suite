import React from 'react';
import {getInsetShadow} from '../color.ts';
import {Borders, D, O, T} from '../synth/design/index.ts';
import type {StyleTheme} from '../synth/StyleTypes.ts';

/** A knob's label, in the knob's color: plain beside or under the knob, aligned to it, or centred on a cutout chip. */
export function KnobLabel({text, cutout, color, style, align}: {
  text: string; cutout: boolean; color: string; style: StyleTheme; align: 'left' | 'right' | 'center';
}) {
  const type = {...T.label, textTransform: 'uppercase', color} as const;
  return cutout ? <div style={{...type,
    padding: `${D.spacing.microGap}px ${D.spacing.tightGap * 1.5}px`, borderRadius: D.radius.tiny,
    background: style.cutoutBackground,
    border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
    boxShadow: getInsetShadow('shallow'), textAlign: 'center', whiteSpace: 'nowrap'}}>{text}</div>
    : <div style={{...type, textAlign: align, opacity: O.medium}}>{text}</div>;
}
