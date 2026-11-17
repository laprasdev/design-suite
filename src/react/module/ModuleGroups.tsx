import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, S, T } from '../../synth/design/index.ts';
import { SegmentedControl, TEXT_SEGMENT_VARIANT } from '../SegmentedControl.tsx';
import { useStyleThemeVariables } from '../styleTheme.ts';

const G = D.moduleGrid;
const STRIP: React.CSSProperties = {
  flexShrink: 0, maxWidth: '100%', boxSizing: 'border-box', display: 'flex',
  padding: `${G.groupStripPadding}px ${G.headerInset}px 0`,
};
// Inline, the strip sits on the row it is in, as tall as its chips and centred on the row's line.
const INLINE_STRIP: React.CSSProperties = { ...STRIP, padding: 0 };
/** A group's row: one line of label type between the group padding. A rail whose rows read as groups sets it too. */
export const GROUP_ROW: React.CSSProperties = {
  '--segment-padding-block': `${G.groupPaddingBlock}px`, '--segment-padding-inline': `${G.groupPaddingInline}px`,
};
const CONTROL: React.CSSProperties = { ...GROUP_ROW, flexWrap: 'wrap', gap: G.groupGap };
// The label type every other label on a module wears, so a group reads as part of the same page.
const LABEL: React.CSSProperties = { ...T.moduleLabel, textTransform: 'uppercase' };
// Inline, the group being shown stands apart from the ones that only hold something: bold as a title, glowing.
const shownLabel = (glow: string): React.CSSProperties => ({
  ...LABEL, fontWeight: T.title.fontWeight, textShadow: S.glow(glow),
});

/**
 * The groups inside a tab, when it holds more than one grid can: the second level, as the SegmentedControl's text
 * form, so the open one slides as the first level's does. A group with nothing set inside it reads dim; inline, the
 * open one is bold and glows.
 */
export function ModuleGroups<Id extends string>({ groups, value, onChange, ariaLabel, inline, disabled }: {
  groups: { id: Id; label: string; set: boolean }[]; value: Id; onChange: (id: Id) => void; ariaLabel: string;
  /** On a row of its own controls, such as a band's tag, rather than under a module's header. */
  inline?: boolean; disabled?: boolean;
}) {
  const { primaryColor } = useStyle().getEffectiveStyle();
  const shown = shownLabel(primaryColor);
  const options = groups.map(group => ({
    value: group.id, ariaLabel: group.label,
    label: <span style={inline && group.id === value ? shown : LABEL}>{group.label}</span>,
    style: group.set ? { color: primaryColor } : undefined,
    data: { 'data-group': group.id, 'data-group-set': group.set },
  }));
  return <div data-module-groups style={{ ...(inline ? INLINE_STRIP : STRIP), ...useStyleThemeVariables() }}>
    <SegmentedControl<Id> tabs variant={TEXT_SEGMENT_VARIANT} ariaLabel={ariaLabel} value={value}
      onChange={onChange} disabled={disabled} style={CONTROL} options={options} />
  </div>;
}
