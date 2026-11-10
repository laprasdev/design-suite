import React from 'react';
import {skinForm} from '../../skinForms.ts';
import {ChoiceSkinForm, SkinKind} from '../../skinKinds.ts';
import {SkinChoice} from './SkinChoice.tsx';
import { useStyle } from '../../synth/StyleContext.tsx';
import { T } from '../../synth/design/index.ts';
import {LayoutDimensions} from '../../layout.ts';

const G = LayoutDimensions.moduleGrid;
import { cutoutBox, cutoutEdge, inputOpacity } from './inputStyle.ts';
import { selectCaret } from './selectCaret.ts';
const MODULE_ICON_CHOICE = 'data-icon-choice';

interface SelectOption<Value> { value: Value; label: string; group?: string }
interface SelectProps<Value> {
  value: Value; options: SelectOption<Value>[]; onChange?: (value: Value) => void; ariaLabel: string;
  skinKind?: typeof SkinKind.CHOICE;
  appearance?: typeof ChoiceSkinForm.TEXT;
  /** An icon form retains the same native choice list and keyboard behavior. */
  icon?: React.ReactNode;
  disabled?: boolean; fill?: boolean; title?: string;
}

/**
 * A compact list on a module's grid, for choices too many to show as options. An option with a `group` is listed
 * under that group's heading, so its own label needn't repeat it. `title` names the whole choice where the box cuts
 * it short.
 */
export function ModuleSelect<Value extends string | number>(
  {value, options, onChange, ariaLabel, disabled, fill, title, skinKind, appearance, icon}:
    SelectProps<Value>,
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
  const plain = appearance === ChoiceSkinForm.TEXT;
  // The ground is a colour, not the `background` shorthand, so the caret's image beside it never conflicts with it.
  const selectStyle: React.CSSProperties = {
    ...T.moduleValue, ...cutoutEdge(style), backgroundColor: style.cutoutBackground, ...(plain ? {border: 0,
      borderRadius: 0, padding: 0, backgroundColor: 'transparent', boxShadow: 'none'} : {}),
    ...(!icon && selectCaret(style, plain ? 0 : G.inputPadding)),
    minWidth: 0, maxWidth: '100%', width: fill ? '100%' : undefined,
    opacity: inputOpacity(disabled),
  };
  const select = <select aria-label={ariaLabel} title={title} value={String(value)} disabled={disabled || !onChange}
    onChange={choose} style={icon ? {...selectStyle, position: 'absolute', inset: 0, width: '100%',
      height: '100%', opacity: 0, cursor: 'inherit'} : selectStyle}>
    {options.filter(option => !option.group).map(item)}
    {groups.map(group => <optgroup key={group} label={group}>{inGroup(group)}</optgroup>)}
  </select>;
  if (!icon) return select;
  return <label {...{ [MODULE_ICON_CHOICE]: true }} title={title}
    style={{...cutoutBox(style), padding: 0, position: 'relative',
    flex: 'none', boxSizing: 'border-box', width: G.iconChoiceBox, height: G.iconChoiceBox, display: 'grid',
    placeItems: 'center',
    opacity: inputOpacity(disabled), cursor: disabled ? 'default' : 'pointer'}}>
    <span aria-hidden style={{width: G.iconChoiceGlyph, height: G.iconChoiceGlyph, display: 'grid',
      placeItems: 'center', color: style.primaryColor, fontSize: G.iconChoiceGlyph, lineHeight: 1}}>{icon}</span>
    {select}
  </label>;
}
