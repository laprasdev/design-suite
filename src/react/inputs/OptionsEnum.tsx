import React from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import type {StyleTheme} from '../../synth/StyleTypes.ts';
import {getColorScheme, hexToRgba, resolveColorType} from '../../color.ts';
import {D, F, C, O, T, TransitionKeys, applyCasing} from '../../synth/design/index.ts';
import type {SingleSelectEnumProps, EnumOption} from './enumProps.ts';
import {skinForm} from '../../skinForms.ts';
import {SkinKind} from '../../skinKinds.ts';
import {SkinChoice} from './SkinChoice.tsx';

export function OptionsEnum<Value>(props: Omit<SingleSelectEnumProps<Value>, 'variant'> & {
  appearance?: string; ariaLabel?: string;
}) {
  const context = useStyle(), style = context.getEffectiveStyle();
  const form = props.appearance ?? skinForm(context.skin, props.litValues ? SkinKind.FLAGS : SkinKind.CHOICE);
  if (form) return <SkinChoice {...props} appearance={form}/>;
  return <LegacyOptions {...props} style={style} scheme={getColorScheme(resolveColorType(props.color), style)}/>;
}

function LegacyOptions<T>({options, value, onChange, disabled, scheme, style, className = '', columns,
  litValues}: SingleSelectEnumProps<T> & {scheme: ReturnType<typeof getColorScheme>; style: StyleTheme}) {
  const {advancedSettings} = useStyle();
  const fmtLabel = (option: EnumOption<T>) =>
    applyCasing(option.label || String(option.value), advancedSettings.enumCasing ?? 'ALL CAPITALS');
  const { optionGap, optionPaddingBlock, optionPaddingInline } = D.moduleGrid;
  const flow: React.CSSProperties = columns
    ? {display: F.grid, gridTemplateColumns: `repeat(${Math.min(columns, options.length)}, minmax(0, 1fr))`}
    : {display: 'flex', flexWrap: 'wrap'};
  return (
    <div className={className} data-enum-options style={{ ...flow, width: '100%', gap: optionGap }}>
      {options.map((option, index) => {
        const selected = litValues ? litValues.includes(option.value) : option.value === value;
        return (
          <button key={index} type="button" disabled={disabled} aria-pressed={selected}
            title={option.tooltip ?? option.label}
            onClick={() => onChange?.(option.value)}
            style={{
              ...T.moduleLabel, minWidth: 0, padding: `${optionPaddingBlock}px ${optionPaddingInline}px`,
              ...(columns ? {} : {flex: '1 0 auto', maxWidth: '100%', overflowWrap: 'anywhere'}),
              borderRadius: D.radius.button, border: 'none', cursor: disabled ? C.notAllowed : C.pointer,
              background: selected ? scheme.main : hexToRgba(scheme.main, O.trace),
              color: selected ? style.backgroundColor : style.textColor,
              transition: TransitionKeys.fast,
            }}>
            {fmtLabel(option)}
          </button>
        );
      })}
    </div>
  );
}
