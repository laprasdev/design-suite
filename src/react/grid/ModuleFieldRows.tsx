import React, { useContext } from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O, T, TransitionKeys } from '../../synth/design/index.ts';
import { FieldEmphasis, type FieldEmphasisValue } from '../../fields.ts';
import { FieldAlign } from './gridContext.ts';
import { CONTROL_OPACITY, FieldName } from './FieldName.tsx';

const G = D.moduleGrid;

/** A range's two ends, drawn beside its track: low left of it and high right of it. A duration has only the
 *  high end. */
export interface RowEnds { low?: React.ReactNode; high: React.ReactNode }

/** How a set of rows shares its columns: the ends form's name, low, track and high, or the lead form's lead, track and
 *  tool, where a row's controls take the name's place and it is as tall as a line to press, never stretched. */
export const RowsForm = Object.freeze({ ENDS: 'ends', LEAD: 'lead' } as const);
type RowsFormValue = typeof RowsForm[keyof typeof RowsForm];
const RowsShared = React.createContext<RowsFormValue | null>(null);
/** Whether the row is one of several that share their columns, so what wraps it must pass those columns on. */
export const useRowsShared = () => useContext(RowsShared) !== null;
const RANGE_COLUMNS = 'max-content max-content minmax(0, 1fr) max-content';
const LEAD_COLUMNS = 'minmax(0, 1fr) minmax(0, 1fr) max-content';
const SUBGRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'subgrid', gridColumn: '1 / -1' };
const ROWS_STYLE: React.CSSProperties = {
  flex: 1, minWidth: 0, minHeight: 0, boxSizing: 'border-box', overflow: 'auto', display: 'grid',
  gridTemplateColumns: RANGE_COLUMNS, gridAutoRows: '1fr', alignItems: 'center',
  columnGap: G.rowGap, rowGap: G.fillGap, padding: G.fillPadding, lineHeight: G.tightLine,
};
/** Rows at their pitch take only their own height, and give up what they would take, down to their controls' own
 *  height, when the room is less: nothing is clipped and nothing scrolls. */
const LEAD_ROWS_STYLE: React.CSSProperties = {
  ...ROWS_STYLE, flex: '0 1 auto', overflow: 'visible', gridTemplateColumns: LEAD_COLUMNS,
  gridAutoRows: `minmax(min-content, ${G.yesNoLine}px)`, rowGap: 0, padding: 0, alignContent: 'start',
  alignItems: 'stretch',
  columnGap: G.detailLineGap,
};

/**
 * Several rows on one grid: their name, low value, track and high value columns are shared, so every track starts and
 * ends on the same lines, and the rows share the body's height evenly with each row's controls centred in it. In the
 * lead form each row is its lead controls, its track and its tool, at one pitch.
 */
export function ModuleFieldRows({ form = RowsForm.ENDS, children }: {
  form?: RowsFormValue; children: React.ReactNode;
}) {
  return <RowsShared.Provider value={form}>
    <div data-module-rows style={form === RowsForm.LEAD ? LEAD_ROWS_STYLE : ROWS_STYLE}>{children}</div>
  </RowsShared.Provider>;
}

const rowColumns = (ends: boolean, shared: RowsFormValue | null): React.CSSProperties => {
  const name = `minmax(${G.rowLabelWidth}px, max-content)`;
  const value = `minmax(${G.rowValueWidth}px, max-content)`;
  if (!ends) return { display: 'grid', gridTemplateColumns: `${name} minmax(0, 1fr) ${value}` };
  return shared ? SUBGRID
    : { display: 'grid', gridTemplateColumns: `${name} ${G.rowEndWidth}px minmax(0, 1fr) ${G.rowEndWidth}px` };
};

interface FieldRowProps {
  label: string; icon?: React.ReactNode; value?: React.ReactNode; ends?: RowEnds; emphasis: FieldEmphasisValue;
  onName?: () => void; nameLabel?: string; nameTitle?: string; children: React.ReactNode;
  /** In the lead form, the controls that take the name's place, and the tool beside the track. */
  lead?: React.ReactNode; tool?: React.ReactNode;
  /** Names the row as a group of controls, for the ones beside it that share its kind. */
  groupLabel?: string;
}

/**
 * A field as a row across its cells: its name, the control, and what it reads. For a range, whose control wants the
 * width. With `ends` the values sit beside the track instead of trailing it, and inside a ModuleFieldRows the row
 * takes its columns from it.
 */
export function ModuleFieldRow(props: FieldRowProps) {
  const { label, icon, value, ends, emphasis, onName, nameLabel, nameTitle, lead, tool, groupLabel, children } = props;
  const group = groupLabel ? { role: 'group', 'aria-label': groupLabel } : {};
  const style = useStyle().getEffectiveStyle();
  const shared = useContext(RowsShared);
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  const valueStyle: React.CSSProperties = {
    ...T.moduleValue, fontVariantNumeric: 'tabular-nums', color: hexToRgba(style.textColor, set ? O.full : O.high),
  };
  const controlStyle: React.CSSProperties = {
    display: 'flex', minWidth: 0, opacity: CONTROL_OPACITY[emphasis], pointerEvents: inert ? 'none' : undefined,
    transition: TransitionKeys.fast, ...(ends && ends.low === undefined && { gridColumn: '2 / 4' }),
  };
  if (shared === RowsForm.LEAD) return (
    <div {...group} data-module-field={label} data-field-emphasis={emphasis} aria-disabled={inert}
      style={{ ...SUBGRID, alignItems: 'center', columnGap: 'inherit', minWidth: 0 }}>
      <div data-field-lead style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)',
        columnGap: 'inherit', minWidth: 0 }}>{lead}</div>
      <div data-field-control style={controlStyle}>{children}</div>
      <div data-field-tool style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        columnGap: G.nameIconGap }}>{tool}</div>
    </div>
  );
  return (
    <div {...group} data-module-field={label} data-field-emphasis={emphasis} aria-disabled={inert}
      style={{ ...rowColumns(!!ends, shared), alignItems: 'center', columnGap: G.rowGap, width: '100%' }}>
      <div style={{ justifySelf: 'start' }}>
        <FieldName label={label} icon={icon} emphasis={emphasis} onName={onName} nameLabel={nameLabel}
          nameTitle={nameTitle} align={FieldAlign.START} rowTall />
      </div>
      {ends?.low !== undefined &&
        <div data-field-value="low" style={{ ...valueStyle, textAlign: 'right' }}>{ends.low}</div>}
      <div data-field-control style={controlStyle}>{children}</div>
      {ends
        ? <div data-field-value="high" style={{ ...valueStyle, textAlign: 'left' }}>{ends.high}</div>
        : <div data-field-value style={{ ...valueStyle, textAlign: 'right' }}>{value}</div>}
    </div>
  );
}
