import React from 'react';
import {skinForm} from '../../skinForms.ts';
import {SkinChoice} from './SkinChoice.tsx';
import { useStyle } from '../../synth/StyleContext.tsx';
import { T } from '../../synth/design/index.ts';
import { cutoutBox, inputOpacity } from './inputStyle.ts';

interface SelectOption<Value> { value: Value; label: string; group?: string }
interface SelectProps<Value> {
  value: Value; options: SelectOption<Value>[]; onChange?: (value: Value) => void; ariaLabel: string;
  skinKind?: 'choice';
  disabled?: boolean; fill?: boolean; title?: string;
}

/**
 * A compact list on a module's grid, for choices too many to show as options. An option with a `group` is listed
 * under that group's heading, so its own label needn't repeat it. `title` names the whole choice where the box cuts
 * it short.
 */
export function ModuleSelect<Value extends string | number>(
  { value, options, onChange, ariaLabel, disabled, fill, title, skinKind }: SelectProps<Value>,
) {
  const context = useStyle(), style = context.getEffectiveStyle();
  const form = skinKind && skinForm(context.skin, skinKind);
  if (form) return <SkinChoice appearance={form} ariaLabel={ariaLabel} options={options}
    value={value} onChange={onChange} disabled={disabled}/>;
  const item = (option: SelectOption<Value>) =>
    <option key={String(option.value)} value={String(option.value)}>{option.label}</option>;
  const inGroup = (group: string) => options.filter(option => option.group === group).map(item);
  const groups = [...new Set(options.flatMap(option => option.group ? [option.group] : []))];
  const choose = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const found = options.find(option => String(option.value) === event.target.value);
    if (found) onChange?.(found.value);
  };
  const selectStyle: React.CSSProperties = {
    ...T.moduleValue, ...cutoutBox(style), minWidth: 0, maxWidth: '100%', width: fill ? '100%' : undefined,
    opacity: inputOpacity(disabled),
  };
  return <select aria-label={ariaLabel} title={title} value={String(value)} disabled={disabled || !onChange}
    onChange={choose} style={selectStyle}>
    {options.filter(option => !option.group).map(item)}
    {groups.map(group => <optgroup key={group} label={group}>{inGroup(group)}</optgroup>)}
  </select>;
}
