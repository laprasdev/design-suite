import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, T } from '../../synth/design/index.ts';
import { SegmentedControl, TEXT_SEGMENT_VARIANT } from '../SegmentedControl.tsx';
import { useStyleThemeVariables } from '../styleTheme.ts';

const G = D.moduleGrid;
const STRIP: React.CSSProperties = {
  flexShrink: 0, maxWidth: '100%', boxSizing: 'border-box', display: 'flex',
  padding: `${G.groupStripPadding}px ${G.headerInset}px 0`,
};
// Inline, the strip sits on the row it is in, as tall as its chips and centred on the row's line.
const INLINE_STRIP: React.CSSProperties = { ...STRIP, padding: 0 };
const CONTROL: React.CSSProperties = {
  flexWrap: 'wrap', gap: G.groupGap,
  '--segment-padding-block': `${G.groupPaddingBlock}px`, '--segment-padding-inline': `${G.groupPaddingInline}px`,
};
// The label type every other label on a module wears, so a group reads as part of the same page.
const LABEL: React.CSSProperties = { ...T.moduleLabel, textTransform: 'uppercase' };

/**
 * The groups inside a tab, when it holds more than one grid can: the second level, as the SegmentedControl's text
 * form, so the open one slides as the first level's does. A group with nothing set inside it reads dim.
 */
export function ModuleGroups<Id extends string>({ groups, value, onChange, ariaLabel, inline }: {
  groups: { id: Id; label: string; set: boolean }[]; value: Id; onChange: (id: Id) => void; ariaLabel: string;
  /** On a row of its own controls, such as a band's tag, rather than under a module's header. */
  inline?: boolean;
}) {
  const { primaryColor } = useStyle().getEffectiveStyle();
  const options = groups.map(group => ({
    value: group.id, label: <span style={LABEL}>{group.label}</span>, ariaLabel: group.label,
    style: group.set ? { color: primaryColor } : undefined,
    data: { 'data-group': group.id, 'data-group-set': group.set },
  }));
  return <div data-module-groups style={{ ...(inline ? INLINE_STRIP : STRIP), ...useStyleThemeVariables() }}>
    <SegmentedControl<Id> tabs variant={TEXT_SEGMENT_VARIANT} ariaLabel={ariaLabel} value={value}
      onChange={onChange} style={CONTROL} options={options} />
  </div>;
}
