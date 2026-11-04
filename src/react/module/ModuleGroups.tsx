import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D } from '../../synth/design/index.ts';
import { SegmentedControl, TEXT_SEGMENT_VARIANT } from '../SegmentedControl.tsx';
import { useSegmentTheme } from './segmentTheme.ts';

const G = D.moduleGrid;
const STRIP: React.CSSProperties = {
  flexShrink: 0, maxWidth: '100%', boxSizing: 'border-box', display: 'flex',
  padding: `${G.groupStripPadding}px ${G.headerInset}px 0`,
};
const CONTROL: React.CSSProperties = {
  flexWrap: 'wrap', gap: G.groupGap,
  '--segment-padding-block': `${G.groupPaddingBlock}px`, '--segment-padding-inline': `${G.groupPaddingInline}px`,
};
const UPPERCASE: React.CSSProperties = { textTransform: 'uppercase' };

/**
 * The groups inside a tab, when it holds more than one grid can: the second level, as the SegmentedControl's text
 * form, so the open one slides as the first level's does. A group with nothing set inside it reads dim.
 */
export function ModuleGroups<Id extends string>({ groups, value, onChange, ariaLabel }: {
  groups: { id: Id; label: string; set: boolean }[]; value: Id; onChange: (id: Id) => void; ariaLabel: string;
}) {
  const { primaryColor } = useStyle().getEffectiveStyle();
  const options = groups.map(group => ({
    value: group.id, label: <span style={UPPERCASE}>{group.label}</span>, ariaLabel: group.label,
    style: group.set ? { color: primaryColor } : undefined,
    data: { 'data-group': group.id, 'data-group-set': group.set },
  }));
  return <div data-module-groups style={{ ...STRIP, ...useSegmentTheme() }}>
    <SegmentedControl<Id> tabs variant={TEXT_SEGMENT_VARIANT} ariaLabel={ariaLabel} value={value}
      onChange={onChange} style={CONTROL} options={options} />
  </div>;
}
