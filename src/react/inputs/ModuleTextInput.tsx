import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { D, T } from '../../synth/design/index.ts';
import { cutoutBox } from './inputStyle.ts';

type ControlledField = {value: string; onChange(value: string): void; ariaLabel: string; fill?: boolean};
type NativeInput = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'children'>;
type NativeTextarea = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'children'>;
export type TextInputProps = ControlledField & (
  | (NativeInput & {multiline?: false; inputRef?: React.Ref<HTMLInputElement>})
  | (NativeTextarea & {multiline: true; inputRef?: React.Ref<HTMLTextAreaElement>})
);
/** Page fields inherit the page's tokens; module fields supply their cutout below. */
export function TextInput(props: TextInputProps) {
  const style: React.CSSProperties = {width: props.fill ? '100%' : undefined, minWidth: 0,
    boxSizing: 'border-box', ...props.style};
  if (props.multiline) {
    const {value, onChange, ariaLabel, fill, multiline, inputRef, className = '', rows = 3, ...attributes} = props;
    return <textarea {...attributes} ref={inputRef} className={`bd-text-input ${className}`}
      aria-label={ariaLabel} value={value} rows={rows} onChange={event => onChange(event.target.value)}
      style={{...style, resize: props.style?.resize ?? 'vertical'}} />;
  }
  const {value, onChange, ariaLabel, fill, multiline, inputRef, className = '', ...attributes} = props;
  return <input type="text" {...attributes} ref={inputRef} className={`bd-text-input ${className}`}
    aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)} style={style} />;
}
/** The module form retains its established cutout and fixed field width. */
export function ModuleTextInput(props: TextInputProps) {
  const theme = useStyle().getEffectiveStyle();
  return <TextInput {...props} className={`bd-module-text ${props.className ?? ''}`}
    style={{...T.moduleValue, ...(props.multiline && {fontFamily: 'inherit'}),
    width: props.fill ? '100%' : D.moduleGrid.numberInputWidth, ...cutoutBox(theme), ...props.style}} />;
}
