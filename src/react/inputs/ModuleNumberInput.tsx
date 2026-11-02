import React, { useState } from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, T } from '../../synth/design/index.ts';
import { useControlGesture } from '../../synth/components/synth/base/useControlBehavior.ts';
import { cutoutBox, inputOpacity } from './inputStyle.ts';

/**
 * A typed number. What's being typed stays as typed, and only a real number writes. Everything typed between focus and
 * blur is one undo step.
 */
export function ModuleNumberInput({ value, onChange, ariaLabel, disabled, fill }: {
  value: number; onChange?: (value: number) => void; ariaLabel: string; disabled?: boolean; fill?: boolean;
}) {
  const style = useStyle().getEffectiveStyle();
  const gesture = useControlGesture();
  const [typing, setTyping] = useState<string | null>(null);
  const type = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTyping(event.target.value);
    const next = event.target.valueAsNumber;
    if (Number.isFinite(next)) onChange?.(next);
  };
  const inputStyle: React.CSSProperties = {
    ...T.moduleValue, width: fill ? '100%' : D.moduleGrid.numberInputWidth, minWidth: 0, boxSizing: 'border-box',
    ...cutoutBox(style), opacity: inputOpacity(disabled),
  };
  return <input type="number" step="any" aria-label={ariaLabel} disabled={disabled} value={typing ?? String(value)}
    onFocus={() => { setTyping(String(value)); gesture.begin(); }} onBlur={() => { setTyping(null); gesture.end(); }}
    onChange={type} style={inputStyle} />;
}
