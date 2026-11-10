import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, O, T } from '../../synth/design/index.ts';

const G = D.moduleGrid;

/** The header's one layout: which group is open on the left, then its tabs and any switch on the right. */
export function ModuleHeaderRow({ group, children }: { group?: string; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  // The group's name yields first. Controls stay on one row and remain reachable by horizontal scroll.
  const groupStyle: React.CSSProperties = {
    ...T.moduleLabel, lineHeight: `${G.headerLineHeight}px`, flex: '1 1 0', minWidth: 0,
    overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase', color: style.textColor, opacity: O.high,
    whiteSpace: 'nowrap',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'safe flex-end',
    gap: G.headerGap, flex: 1, minWidth: 0, whiteSpace: 'nowrap',
    overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
  };
  return (
    <div data-module-header-row style={rowStyle}>
      {group && <span data-open-group title={group} style={groupStyle}>{group}</span>}
      {children}
    </div>
  );
}
