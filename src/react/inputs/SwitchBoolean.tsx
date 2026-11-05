import React from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {C, TransitionKeys} from '../../synth/design/index.ts';
import type {SwitchBooleanProps} from '../../synth/components/synth/Boolean.tsx';
const HEIGHT = 10, WIDTH_RATIO = 2, INSET_RATIO = 0.2;
export function SwitchBoolean({value, onChange, ariaLabel, height = HEIGHT, disabled}: SwitchBooleanProps) {
  const style = useStyle().getEffectiveStyle(), color = style.primaryColor;
  const width = height * WIDTH_RATIO, inset = height * INSET_RATIO, thumb = height - inset * 2;
  return <button type="button" role="switch" aria-checked={value} aria-label={ariaLabel} disabled={disabled}
    onClick={() => onChange(!value)} style={{position: 'relative', flex: 'none', width, height, padding: 0,
      border: 'none', borderRadius: height / 2, cursor: disabled ? C.notAllowed : C.pointer,
      background: value ? color : style.knobGradient.at(-1), transition: TransitionKeys.normal}}>
    <span style={{position: 'absolute', top: inset, left: value ? width - inset - thumb : inset,
      width: thumb, height: thumb, borderRadius: '50%', background: value ? style.backgroundColor : color,
      transition: TransitionKeys.normal}}/>
  </button>;
}
