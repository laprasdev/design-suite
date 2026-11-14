import React from 'react';
import type {SingleSelectEnumProps} from './enumProps.ts';
import {SegmentedControl} from '../SegmentedControl.tsx';
import {Cycle} from '../Cycle.tsx';
import {ListboxSelect} from '../ListboxSelect.tsx';
import {ChoiceSkinForm} from '../../skinKinds.ts';
import {ChoiceGrid} from './ChoiceGrid.tsx';
import {ICONS_CELL, usePointHint} from './picturedParts.ts';
import {useStyleThemeVariables} from '../styleTheme.ts';

export function SkinChoice<Value>({appearance, ariaLabel = 'Choices', options, value, onChange, litValues,
  disabled, columns, className}: SingleSelectEnumProps<Value> & {appearance: string; ariaLabel?: string}) {
  const grid = appearance === ChoiceSkinForm.GRID, icons = appearance === ChoiceSkinForm.ICONS;
  const pictured = grid || icons;
  const items = options.map((option, index) => {
    const named = option.label ?? String(option.value);
    if (pictured && !option.icon) throw new Error(`The ${appearance} form draws icons, and ${named} has none.`);
    const label = pictured && option.icon ? option.icon : named;
    return {value: index, label, ariaLabel: named, title: pictured ? undefined : option.tooltip, hint: option.tooltip};
  });
  const theme = useStyleThemeVariables(), point = usePointHint(items);
  const selected = options.findIndex(option => option.value === value);
  const choose = (index: number) => {if (options[index]) onChange?.(options[index].value);};
  if (grid && litValues) throw new Error('The grid form draws one choice, not flags.');
  if (grid) return <ChoiceGrid options={items} selected={selected} onChoose={choose}
    ariaLabel={ariaLabel} disabled={disabled || !onChange}/>;
  if (!litValues && appearance === ChoiceSkinForm.SELECT) return <ListboxSelect label={ariaLabel} value={selected}
    options={items.map(item => ({...item, label: item.ariaLabel}))} onChange={choose}
    disabled={disabled || !onChange}/>;
  if (!litValues && appearance === ChoiceSkinForm.CYCLE) return <Cycle label={ariaLabel} value={selected}
    options={items.map(item => ({...item, label: item.ariaLabel}))} onChange={choose}
    disabled={disabled || !onChange}/>;
  const common = {options: items, disabled: disabled || !onChange, variant: appearance, className, ariaLabel,
    scroll: !columns, ...(icons && {...ICONS_CELL, onPoint: point}),
    style: {...(icons && theme),
      ...(columns && {display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`})}};
  if (!litValues) return <SegmentedControl {...common} value={selected} onChange={choose}/>;
  const lit = options.flatMap((option, index) => litValues.includes(option.value) ? [index] : []);
  return <SegmentedControl {...common} multiple value={lit} onChange={next => {
    const changed = items.find(item => lit.includes(item.value) !== next.includes(item.value));
    if (changed) choose(changed.value);
  }}/>;
}
