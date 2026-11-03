import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, O, T } from '../../synth/design/index.ts';

const G = D.moduleGrid;

/** The header's one layout: which group is open on the left, then its tabs and any switch on the right. */
export function ModuleHeaderRow({ group, children }: { group?: string; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  // The group's name takes what room is left and is cut first, so the tabs and switches beside it stay on one row as
  // long as they fit.
  const groupStyle: React.CSSProperties = {
    ...T.moduleLabel, alignSelf: 'flex-start', lineHeight: `${G.headerLineHeight}px`, flex: '1 1 0', minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', color: style.textColor, opacity: O.high,
    whiteSpace: 'nowrap',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'flex-end', gap: G.headerGap, flex: 1,
    minWidth: 0,
  };
  return (
    <div style={rowStyle}>
      {group && <span data-open-group title={group} style={groupStyle}>{group}</span>}
      {children}
    </div>
  );
}
