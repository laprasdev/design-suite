import React from 'react';
import type {SingleSelectEnumProps} from '../../synth/components/synth/Enum.tsx';
import {SegmentedControl} from '../SegmentedControl.tsx';
import {Cycle} from '../Cycle.tsx';
import {ListboxSelect} from '../ListboxSelect.tsx';

export function SkinChoice<Value>({appearance, ariaLabel = 'Choices', options, value, onChange, litValues,
  disabled, columns, className}: SingleSelectEnumProps<Value> & {appearance: string; ariaLabel?: string}) {
  const items = options.map((option, index) => ({value: index,
    label: appearance === 'icons' ? option.icon ?? option.label ?? String(option.value)
      : option.label ?? String(option.value),
    ariaLabel: option.label ?? String(option.value), title: option.tooltip}));
  const selected = options.findIndex(option => option.value === value);
  const choose = (index: number) => {if (options[index]) onChange?.(options[index].value);};
  if (!litValues && appearance === 'select') return <ListboxSelect label={ariaLabel} value={selected}
    options={items.map(item => ({...item, label: item.ariaLabel}))} onChange={choose}
    disabled={disabled || !onChange}/>;
  if (!litValues && appearance === 'cycle') return <Cycle label={ariaLabel} value={selected}
    options={items.map(item => ({...item, label: item.ariaLabel}))} onChange={choose}
    disabled={disabled || !onChange}/>;
  const common = {options: items, disabled: disabled || !onChange, variant: appearance, className, ariaLabel,
    style: columns ? {display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`} : undefined};
  if (!litValues) return <SegmentedControl {...common} value={selected} onChange={choose}/>;
  const lit = options.flatMap((option, index) => litValues.includes(option.value) ? [index] : []);
  return <SegmentedControl {...common} multiple value={lit} onChange={next => {
    const changed = items.find(item => lit.includes(item.value) !== next.includes(item.value));
    if (changed) choose(changed.value);
  }}/>;
}
