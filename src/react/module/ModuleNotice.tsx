import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O, T } from '../../synth/design/index.ts';

const { noticePadding } = D.moduleGrid;

/** A sentence in a module saying what it can't do yet, or what limit applies. */
export function ModuleNotice({ children }: { children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  const noticeStyle: React.CSSProperties = {
    ...T.moduleValue, margin: 0, flexShrink: 0, padding: `0 ${noticePadding}px ${noticePadding}px`,
    color: hexToRgba(style.textColor, O.high),
  };
  return <p data-module-notice style={noticeStyle}>{children}</p>;
}
