import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O, T } from '../../synth/design/index.ts';

const G = D.moduleGrid;
const STRIP: React.CSSProperties = {
  flexShrink: 0, maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: G.groupGap,
  padding: `${G.groupStripPadding}px ${G.headerInset}px 0`,
};

/**
 * Text chips for the groups inside a tab: the second level, when a tab holds more than one grid can. A dim chip has
 * nothing set inside it.
 */
export function ModuleGroups<Id extends string>({ groups, value, onChange, ariaLabel }: {
  groups: { id: Id; label: string; set: boolean }[]; value: Id; onChange: (id: Id) => void; ariaLabel: string;
}) {
  const style = useStyle().getEffectiveStyle();
  const chipStyle = (open: boolean, set: boolean): React.CSSProperties => ({
    ...T.moduleLabel, padding: `${G.groupPaddingBlock}px ${G.groupPaddingInline}px`, border: 'none',
    borderRadius: D.radius.button, cursor: 'pointer', textTransform: 'uppercase',
    background: open ? hexToRgba(style.primaryColor, O.subtle) : 'transparent',
    color: open || set ? style.primaryColor : hexToRgba(style.textColor, O.high),
  });
  return <div role="tablist" aria-label={ariaLabel} data-module-groups style={STRIP}>
    {groups.map(group => {
      const open = group.id === value;
      return <button key={group.id} type="button" role="tab" aria-selected={open} data-group={group.id}
        data-group-set={group.set} onClick={() => onChange(group.id)} style={chipStyle(open, group.set)}>
        {group.label}
      </button>;
    })}
  </div>;
}
