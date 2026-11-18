import React, {useState} from 'react';
import {useDragSession} from '../useDragSession.ts';
import {useStyle} from '../../synth/StyleContext.tsx';
import {skinForm} from '../../skinForms.ts';
import {SkinKind, VectorSkinForm} from '../../skinKinds.ts';
import {ModuleKnob, ModuleField} from '../../synth/components/synth/ModuleGrid.tsx';
import {ModuleNumberInput} from './ModuleNumberInput.tsx';
import {FieldEmphasis} from '../../fields.ts';
import {D, T} from '../../synth/design/index.ts';
const PLANAR_AXES = ['x', 'y'] as const;
export type VectorAxis = 'x' | 'y' | 'z';
export interface VectorInputValue {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}
type Bounds = {readonly min: number; readonly max: number};
interface Props {
  label: string; vector: VectorInputValue; onAxis(axis: VectorAxis, value: number): void;
  disabled?: boolean; appearance?: string; limits?: Partial<Record<VectorAxis, Bounds>>;
}
export function vectorAxes(vector: VectorInputValue): readonly {axis: VectorAxis; value: number}[] {
  const planar: {axis: VectorAxis; value: number}[] = PLANAR_AXES.map(axis => ({axis, value: vector[axis]}));
  return vector.z === undefined ? planar : [...planar, {axis: 'z', value: vector.z}];
}
function AxisInput({label, value, onChange, disabled, bounds}: {
  label: string; value: number; onChange(value: number): void; disabled?: boolean; bounds?: Bounds;
}) {
  const [held, setHeld] = useState<Bounds | null>(null), range = held ?? bounds;
  // The range holds while the knob's press lasts, wherever it is released.
  const release = () => setHeld(null);
  useDragSession(held !== null, {end: release, cancel: release, lostFocus: release});
  const input = <ModuleNumberInput fill ariaLabel={label} value={value} onChange={onChange} disabled={disabled}/>;
  if (!range) return input;
  return <div onMouseDownCapture={() => setHeld(bounds ?? null)}>
    <ModuleField label={label} emphasis={FieldEmphasis.SET} value={input}>
      <ModuleKnob ariaLabel={label} value={value} min={range.min} max={range.max} integer={false}
        onChange={onChange} disabled={disabled}/>
    </ModuleField>
  </div>;
}
export function ModuleVectorInput({label, vector, onAxis, disabled, appearance, limits}: Props) {
  const context = useStyle(), form = appearance ?? skinForm(context.skin, SkinKind.VECTOR);
  const axes = vectorAxes(vector);
  return <div data-field-vector style={{display: 'grid', gridTemplateColumns: `repeat(${axes.length}, minmax(0, 1fr))`,
    gap: D.moduleGrid.fieldGap, width: '100%'}}>
    {axes.map(({axis, value}) => <div key={axis} data-vector-axis={axis} style={{minWidth: 0}}>
      {form !== VectorSkinForm.KNOBS && <span style={T.moduleLabel}>{axis.toUpperCase()}</span>}
      <AxisInput label={`${label} ${axis}`} value={value} disabled={disabled}
        bounds={form === VectorSkinForm.KNOBS ? limits?.[axis] : undefined} onChange={next => onAxis(axis, next)}/>
    </div>)}
  </div>;
}
