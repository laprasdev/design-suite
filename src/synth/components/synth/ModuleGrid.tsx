import React, { useContext } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { hexToRgba } from '../../../color.ts';
import { D, O, T, TransitionKeys } from '../../design/index.ts';
import { Knob, KnobPreset, KnobLabelStyle, KnobLayout, KnobStroke, KnobValueType } from './Knob.tsx';
import type { ModulationProps } from './modulation.ts';
import { FieldEmphasis, YesNo, type FieldEmphasisValue, type YesNoValue } from '../../../fields.ts';
import { FIELD_LINE } from '../../../react/grid/fieldLine.ts';
import { CONTROL_OPACITY, FieldName } from '../../../react/grid/FieldName.tsx';
import { FieldAlign, useFieldAlign, useModuleControlSize, type FieldAlignValue } from '../../../react/grid/gridContext.ts';

// A field's name, the field around its control, the knob and the yes/no, until the field family takes them over.
const G = D.moduleGrid;

/** A cell that fills in height. Its column is min-0 so a wide control shrinks to it. */
export const FILLS_COLUMN: React.CSSProperties = { gridTemplateColumns: 'minmax(0, 1fr)' };
const fillsHeight = (rows: string): React.CSSProperties =>
  ({ ...FILLS_COLUMN, height: '100%', gridTemplateRows: rows });
/** The wrapper of a field that fills its cell: one row, which the field takes. */
export const FILLS_CELL = fillsHeight('minmax(0, 1fr)');
/** A field that fills its cell's height: its control takes the row the name leaves. */
const FILLS_FIELD = fillsHeight('minmax(0, 1fr) auto');

/** How a field sits in its cell: stacked, its control filling the cell's height, or all on one line. */
export const FieldForm = Object.freeze({ STACK: 'stack', FILLS: 'fills', LINE: 'line' } as const);
export type FieldFormValue = typeof FieldForm[keyof typeof FieldForm];

interface FieldProps {
  label: string; icon?: React.ReactNode; value?: React.ReactNode; emphasis: FieldEmphasisValue;
  onName?: () => void; nameLabel?: string; nameTitle?: string; children: React.ReactNode;
}
/** The control, its reading and its name share a centre; `stretch` fills the cell's width. */
interface StackFieldProps extends FieldProps { form?: typeof FieldForm.STACK; stretch?: boolean }
/** As the stack, with the control taking the cell's whole height, for one that grows with it. */
interface FillsFieldProps extends FieldProps { form: typeof FieldForm.FILLS; stretch?: boolean }
/** The control, its name, then its reading, on one yes/no-high line, for a tile too short to stack them. */
interface LineFieldProps extends FieldProps { form: typeof FieldForm.LINE }
export type ModuleFieldProps = StackFieldProps | FillsFieldProps | LineFieldProps;

function fieldControl(emphasis: FieldEmphasisValue, style: React.CSSProperties): React.CSSProperties {
  const inert = emphasis === FieldEmphasis.INERT;
  return {
    ...style, opacity: CONTROL_OPACITY[emphasis], pointerEvents: inert ? 'none' : undefined,
    transition: TransitionKeys.fast,
  };
}

function FieldReading({ value, emphasis, align }: { value: React.ReactNode; emphasis: FieldEmphasisValue; align?: FieldAlignValue }) {
  const style = useStyle().getEffectiveStyle();
  const color = hexToRgba(style.textColor, emphasis === FieldEmphasis.SET ? O.full : O.high);
  return <div data-field-value style={{ ...T.moduleValue, textAlign: align, fontVariantNumeric: 'tabular-nums', color }}>
    {value}
  </div>;
}

function LineField({ label, icon, value, emphasis, onName, nameLabel, nameTitle, children }: LineFieldProps) {
  const name = { label, icon, emphasis, onName, nameLabel, nameTitle, align: FieldAlign.START };
  return <div data-module-field={label} data-field-emphasis={emphasis}
    aria-disabled={emphasis === FieldEmphasis.INERT} style={{ ...FIELD_LINE, minWidth: 0 }}>
    <div data-field-control style={fieldControl(emphasis, { display: 'flex', flex: 'none' })}>{children}</div>
    <FieldName {...name} />
    {value !== undefined && <FieldReading value={value} emphasis={emphasis} />}
  </div>;
}

function StackField(props: StackFieldProps | FillsFieldProps) {
  const { label, icon, value, emphasis, onName, nameLabel, nameTitle, stretch, children } = props;
  const placement = useFieldAlign(), fills = props.form === FieldForm.FILLS;
  const align = FieldAlign.CENTER;
  const width = stretch ? '100%' : undefined;
  const control = { display: 'grid', alignItems: fills ? 'stretch' : 'center',
    justifyItems: stretch ? 'stretch' : align, width };
  return (
    <div data-module-field={label} data-field-emphasis={emphasis} aria-disabled={emphasis === FieldEmphasis.INERT}
      style={{ display: 'grid', justifySelf: placement, justifyItems: align, gap: G.fieldGap,
        width, ...(fills && FILLS_FIELD) }}>
      <div data-field-control style={fieldControl(emphasis, { ...control, ...(fills && FILLS_COLUMN) })}>{children}</div>
      {value !== undefined && <FieldReading value={value} emphasis={emphasis} align={align} />}
      <FieldName label={label} icon={icon} emphasis={emphasis} onName={onName} nameLabel={nameLabel}
        nameTitle={nameTitle} align={align} />
    </div>
  );
}

/**
 * A field in its cell: the control, what it reads, and its name, all staying readable when dim. Pressing the name is optional.
 * Its `form` is one of the stack, the control filling its cell's height, or one line; each takes only the props it draws.
 */
export function ModuleField(props: ModuleFieldProps) {
  return props.form === FieldForm.LINE ? <LineField {...props} /> : <StackField {...props} />;
}

/** The minimal knob, its value and name left to the field around it. */
export function ModuleKnob({ value, min, max, integer, onChange, ariaLabel, disabled, modulators, selectedSource, onSelectSource }: { value: number; min: number; max: number; integer: boolean; onChange: (value: number) => void; ariaLabel: string; disabled?: boolean } & ModulationProps) {
  const size = useModuleControlSize();
  const config = { ...KnobPreset.minimal, size, stroke: KnobStroke.STANDARD, labelStyle: KnobLabelStyle.PLAIN, layout: KnobLayout.KNOB_ONLY, valueType: integer ? KnobValueType.INTEGER : KnobValueType.FLOAT };
  // A whole number can always be dragged onto: past a whole step per pixel, a long range takes a longer drag rather than skipping values.
  const sweep = (max - min) / G.knobDragPx, sensitivity = integer ? Math.min(G.wholeStepsPerPixel, sweep) : sweep;
  return <div role="group" aria-label={ariaLabel}><Knob config={config} tooltip={ariaLabel} sensitivity={sensitivity} value={value} min={min} max={max} disabled={disabled} disabledOpacity={O.full} onChange={onChange} color="primary" modulators={modulators} selectedSource={selectedSource} onSelectSource={onSelectSource} /></div>;
}

export {ModuleYesNo, PowerDot, YesNoDot} from '../../../react/inputs/ModuleYesNo.tsx';
export { ModuleFieldRow, ModuleFieldRows, RowsForm, useRowsShared, type RowEnds }
  from '../../../react/grid/ModuleFieldRows.tsx';
