import React, { useContext } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { hexToRgba } from '../../../color.ts';
import { D, O, T, TransitionKeys } from '../../design/index.ts';
import { Knob, KnobPreset, KnobLabelStyle, KnobLayout, KnobStroke, KnobValueType } from './Knob.tsx';
import type { ModulationProps } from './modulation.ts';
import { FieldEmphasis, YesNo, type FieldEmphasisValue, type YesNoValue } from '../../../fields.ts';
import { FieldAlign, useFieldAlign, useModuleControlSize, type FieldAlignValue } from '../../../react/grid/gridContext.ts';

// A field's name, the field around its control, the knob and the yes/no, until the field family takes them over.
const G = D.moduleGrid;
const CONTROL_OPACITY: Record<FieldEmphasisValue, number> = { set: O.full, quiet: O.medium, inert: O.medium };

/** `rowTall` gives a pressable name the whole height of its row and at least a label's width, where it would otherwise be only its letters. */
function FieldName({ label, icon, emphasis, onName, nameLabel, nameTitle, align = FieldAlign.CENTER, rowTall }: { label: string; icon?: React.ReactNode; emphasis: FieldEmphasisValue; onName?: () => void; nameLabel?: string; nameTitle?: string; align?: FieldAlignValue; rowTall?: boolean }) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  const nameStyle: React.CSSProperties = { ...T.moduleLabel, display: 'inline-flex', alignItems: 'center', justifyContent: align, gap: G.nameIconGap, textTransform: 'uppercase', textAlign: align, color: set ? style.primaryColor : hexToRgba(style.textColor, O.high), transition: TransitionKeys.fast };
  const content = <>{icon}{label}</>;
  return onName && !inert
    ? <button type="button" data-field-name aria-label={nameLabel} title={nameTitle} onClick={onName} style={{ ...nameStyle, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', ...(rowTall && { minHeight: G.yesNoLine, minWidth: G.rowLabelWidth }) }}>{content}</button>
    : <span data-field-name style={nameStyle}>{content}</span>;
}

/** A field in its cell: the control, what it reads, and its name, all staying readable when dim. Pressing the name is optional. */
export function ModuleField({ label, icon, value, emphasis, onName, nameLabel, nameTitle, stretch, children }: { label: string; icon?: React.ReactNode; value?: React.ReactNode; emphasis: FieldEmphasisValue; onName?: () => void; nameLabel?: string; nameTitle?: string; stretch?: boolean; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  const align = useFieldAlign();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  return (
    <div data-module-field={label} data-field-emphasis={emphasis} aria-disabled={inert} style={{ display: 'grid', justifyItems: align, gap: G.fieldGap, width: stretch ? '100%' : undefined }}>
      <div data-field-control style={{ display: 'grid', alignItems: 'center', justifyItems: align, width: stretch ? '100%' : undefined, opacity: CONTROL_OPACITY[emphasis], pointerEvents: inert ? 'none' : undefined, transition: TransitionKeys.fast }}>{children}</div>
      {value !== undefined && <div data-field-value style={{ ...T.moduleValue, textAlign: align, fontVariantNumeric: 'tabular-nums', color: hexToRgba(style.textColor, set ? O.full : O.high) }}>{value}</div>}
      <FieldName label={label} icon={icon} emphasis={emphasis} onName={onName} nameLabel={nameLabel} nameTitle={nameTitle} align={align} />
    </div>
  );
}

/** A range's two ends, drawn beside its track: low left of it and high right of it. A duration has only the high end. */
export interface RowEnds { low?: React.ReactNode; high: React.ReactNode }

const RowsShared = React.createContext(false);
/** Whether the row is one of several that share their columns, so what wraps it must pass those columns on. */
export const useRowsShared = () => useContext(RowsShared);
const RANGE_COLUMNS = 'max-content max-content minmax(0, 1fr) max-content';
const SUBGRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'subgrid', gridColumn: '1 / -1' };
const ROWS_STYLE: React.CSSProperties = {
  flex: 1, minWidth: 0, minHeight: 0, boxSizing: 'border-box', overflow: 'auto', display: 'grid',
  gridTemplateColumns: RANGE_COLUMNS, gridAutoRows: '1fr', alignItems: 'center',
  columnGap: G.rowGap, rowGap: G.fillGap, padding: G.fillPadding, lineHeight: G.tightLine,
};

/**
 * Several rows on one grid: their name, low value, track and high value columns are shared, so every track starts and
 * ends on the same lines, and the rows share the body's height evenly with each row's controls centred in it.
 */
export function ModuleFieldRows({ children }: { children: React.ReactNode }) {
  return <RowsShared.Provider value><div data-module-rows style={ROWS_STYLE}>{children}</div></RowsShared.Provider>;
}

const rowColumns = (ends: boolean, shared: boolean): React.CSSProperties => {
  const name = `minmax(${G.rowLabelWidth}px, max-content)`;
  const value = `minmax(${G.rowValueWidth}px, max-content)`;
  if (!ends) return { display: 'grid', gridTemplateColumns: `${name} minmax(0, 1fr) ${value}` };
  return shared ? SUBGRID
    : { display: 'grid', gridTemplateColumns: `${name} ${G.rowEndWidth}px minmax(0, 1fr) ${G.rowEndWidth}px` };
};

interface FieldRowProps {
  label: string; icon?: React.ReactNode; value?: React.ReactNode; ends?: RowEnds; emphasis: FieldEmphasisValue;
  onName?: () => void; nameLabel?: string; nameTitle?: string; children: React.ReactNode;
}

/**
 * A field as a row across its cells: its name, the control, and what it reads. For a range, whose control wants the
 * width. With `ends` the values sit beside the track instead of trailing it, and inside a ModuleFieldRows the row
 * takes its columns from it.
 */
export function ModuleFieldRow(props: FieldRowProps) {
  const { label, icon, value, ends, emphasis, onName, nameLabel, nameTitle, children } = props;
  const style = useStyle().getEffectiveStyle();
  const shared = useRowsShared();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  const valueStyle: React.CSSProperties = {
    ...T.moduleValue, fontVariantNumeric: 'tabular-nums', color: hexToRgba(style.textColor, set ? O.full : O.high),
  };
  const controlStyle: React.CSSProperties = {
    display: 'flex', minWidth: 0, opacity: CONTROL_OPACITY[emphasis], pointerEvents: inert ? 'none' : undefined,
    transition: TransitionKeys.fast, ...(ends && ends.low === undefined && { gridColumn: '2 / 4' }),
  };
  return (
    <div data-module-field={label} data-field-emphasis={emphasis} aria-disabled={inert}
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

/** The minimal knob, its value and name left to the field around it. */
export function ModuleKnob({ value, min, max, integer, onChange, ariaLabel, disabled, modulators, selectedSource, onSelectSource }: { value: number; min: number; max: number; integer: boolean; onChange: (value: number) => void; ariaLabel: string; disabled?: boolean } & ModulationProps) {
  const size = useModuleControlSize();
  const config = { ...KnobPreset.minimal, size, stroke: KnobStroke.STANDARD, labelStyle: KnobLabelStyle.PLAIN, layout: KnobLayout.KNOB_ONLY, valueType: integer ? KnobValueType.INTEGER : KnobValueType.FLOAT };
  // A whole number can always be dragged onto: past a whole step per pixel, a long range takes a longer drag rather than skipping values.
  const sweep = (max - min) / G.knobDragPx, sensitivity = integer ? Math.min(G.wholeStepsPerPixel, sweep) : sweep;
  return <div role="group" aria-label={ariaLabel}><Knob config={config} tooltip={ariaLabel} sensitivity={sensitivity} value={value} min={min} max={max} disabled={disabled} disabledOpacity={O.full} onChange={onChange} color="primary" modulators={modulators} selectedSource={selectedSource} onSelectSource={onSelectSource} /></div>;
}

/** Solid is on, a ring is off, dotted is not set, and half filled is inherit. */
export function YesNoDot({ state, color }: { state: YesNoValue; color: string }) {
  const size = G.yesNoDot, centre = size / 2, r = centre - G.yesNoStroke;
  const settled = state === YesNo.ON || state === YesNo.OFF;
  return <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: 'none', display: 'block' }}>
    <circle cx={centre} cy={centre} r={r} fill={state === YesNo.ON ? color : 'none'} stroke={hexToRgba(color, settled ? O.full : O.high)} strokeWidth={G.yesNoStroke} strokeDasharray={state === YesNo.UNSET ? `${G.yesNoDash} ${G.yesNoDash}` : undefined} strokeLinecap="round" />
    {state === YesNo.INHERIT && <path d={`M${centre} ${centre - r}A${r} ${r} 0 0 0 ${centre} ${centre + r}Z`} fill={color} />}
  </svg>;
}

/** A yes/no field as one line, its dot then its name, and the whole line is what's pressed. Its name reads as any field's name does. */
export function ModuleYesNo({ label, state, emphasis, onPress, title }: { label: string; state: YesNoValue; emphasis: FieldEmphasisValue; onPress?: () => void; title?: string }) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, locked = emphasis === FieldEmphasis.INERT || !onPress;
  return <button type="button" role="switch" aria-checked={state === YesNo.ON} aria-label={label} data-module-field={label} data-field-emphasis={emphasis} data-yes-no={state} title={title} disabled={locked} onClick={onPress}
    style={{ ...T.moduleLabel, display: 'flex', alignItems: 'center', gap: G.fieldGap, maxWidth: '100%', minHeight: G.yesNoLine, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', textTransform: 'uppercase', cursor: locked ? 'default' : 'pointer', color: set ? style.primaryColor : hexToRgba(style.textColor, O.high) }}>
    <span style={{ display: 'flex', opacity: CONTROL_OPACITY[emphasis], transition: TransitionKeys.fast }}><YesNoDot state={state} color={style.primaryColor} /></span>
    <span data-field-name style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
  </button>;
}
