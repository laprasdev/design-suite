import {HeaderIconButton} from '../HeaderIconButton.tsx';
import type {IconBooleanProps} from './booleanForm.ts';

export function IconBoolean({value, onChange, label, glyphs, bare, density, disabled}: IconBooleanProps) {
  return <HeaderIconButton label={label} active={value} bare={bare} density={density} disabled={disabled}
    onClick={() => onChange(!value)}>{value ? glyphs.on : glyphs.off}</HeaderIconButton>;
}
