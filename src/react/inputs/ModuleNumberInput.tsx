import React, { useState, useEffect } from 'react';
import {skinForm} from '../../skinForms.ts';
import {IntegerIncrementer, IncrementerForm} from '../../synth/components/synth/40-IntegerIncrementer.tsx';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, T } from '../../synth/design/index.ts';
import {useOwnedControlGesture as useControlGesture} from './useOwnedControlGesture.ts';
import { cutoutBox, inputOpacity } from './inputStyle.ts';

/**
 * A typed number. What's being typed stays as typed, and only a real number writes. Everything typed between focus and
 * blur is one undo step.
 */
export function ModuleNumberInput({ value, onChange, ariaLabel, disabled, fill, appearance,
  min = -Infinity, max = Infinity, step = 1, integer = false }: {
  integer?: boolean;
  appearance?: string; min?: number; max?: number; step?: number;
  value: number; onChange?: (value: number) => void; ariaLabel: string; disabled?: boolean; fill?: boolean;
}) {
  const context = useStyle(), style = context.getEffectiveStyle();
  const form = appearance ?? skinForm(context.skin, 'number');
  const gesture = useControlGesture();
  const [typing, setTyping] = useState<string | null>(null);
  useEffect(() => {setTyping(null); return gesture.end;}, [form, gesture]);
  const type = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTyping(event.target.value);
    const next = event.target.valueAsNumber;
    if (Number.isFinite(next)) onChange?.(next);
  };
  const inputStyle: React.CSSProperties = {
    ...T.moduleValue, width: fill ? '100%' : D.moduleGrid.numberInputWidth, minWidth: 0, boxSizing: 'border-box',
    ...cutoutBox(style), opacity: inputOpacity(disabled),
  };
  const input = <input type="number" step="any" aria-label={ariaLabel} disabled={disabled}
    value={typing ?? String(value)}
    onFocus={() => { setTyping(String(value)); gesture.begin(); }} onBlur={() => { setTyping(null); gesture.end(); }}
    onChange={type} style={inputStyle} />;
  if (form === 'horizontal' || form === 'vertical') return <IntegerIncrementer variant={form}
    value={value} onChange={onChange} disabled={disabled} min={min} max={max} step={step} ariaLabel={ariaLabel}>
    {input}
  </IntegerIncrementer>;
  // Meters require a declared, small integer domain. Unbounded and fractional fields stay typed.
  if (form === 'meter' && integer && min >= 0 && max > min && max <= 32 && Number.isInteger(max)
    && Number.isInteger(min) && Number.isInteger(value) && value >= min && value <= max && step === 1)
    return <IntegerIncrementer form={IncrementerForm.METER} value={value} onChange={onChange ?? (() => {})}
      label={ariaLabel} min={min} max={max} disabled={disabled || !onChange}/>;
  return input;
}
