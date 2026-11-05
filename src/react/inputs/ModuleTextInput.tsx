import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, T } from '../../synth/design/index.ts';
import { cutoutBox } from './inputStyle.ts';

/** A typed line of text. */
export function ModuleTextInput({ value, onChange, ariaLabel, placeholder, fill, disabled, multiline,
  rows = 3, maxLength }: {
  value: string; onChange: (value: string) => void; ariaLabel: string; placeholder?: string; fill?: boolean;
  disabled?: boolean; multiline?: boolean; rows?: number; maxLength?: number;
}) {
  const style = useStyle().getEffectiveStyle();
  const inputStyle: React.CSSProperties = {
    ...T.moduleValue, width: fill ? '100%' : D.moduleGrid.numberInputWidth, minWidth: 0, boxSizing: 'border-box',
    ...cutoutBox(style),
  };
  if (multiline) return <textarea aria-label={ariaLabel} value={value} placeholder={placeholder}
    disabled={disabled} rows={rows} maxLength={maxLength}
    onChange={event => onChange(event.target.value)}
    style={{...inputStyle, resize: 'vertical', fontFamily: 'inherit'}}/>;
  return <input type="text" aria-label={ariaLabel} value={value} placeholder={placeholder} disabled={disabled}
    onChange={event => onChange(event.target.value)} style={inputStyle} />;
}
