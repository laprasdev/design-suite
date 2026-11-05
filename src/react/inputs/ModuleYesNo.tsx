import React from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {hexToRgba} from '../../color.ts';
import {D, O, T, TransitionKeys} from '../../synth/design/index.ts';
import {FieldEmphasis, YesNo, type FieldEmphasisValue, type YesNoValue} from '../../fields.ts';
import {skinForm} from '../../skinForms.ts';
import {Boolean as BooleanControl, BooleanForm} from '../../synth/components/synth/Boolean.tsx';
const G = D.moduleGrid;
const CONTROL_OPACITY = {set: O.full, quiet: O.medium, inert: O.medium};
interface Props {
  label: string; state: YesNoValue; emphasis: FieldEmphasisValue; onPress?: () => void;
  title?: string; appearance?: string;
}
export function ModuleYesNo(props: Props) {
  const context = useStyle(), style = context.getEffectiveStyle();
  const form = props.appearance ?? skinForm(context.skin, 'yes-no');
  const {state, label, onPress, emphasis, title} = props;
  if (!form || form === 'dot' || state === YesNo.UNSET || state === YesNo.INHERIT) return <DotYesNo {...props}/>;
  const disabled = !onPress || emphasis === FieldEmphasis.INERT;
  const common = {value: state === YesNo.ON, onChange: () => onPress?.(), disabled};
  return <div data-module-field={label} data-yes-no={state} data-yes-no-form={form} title={title}
    style={{display: 'flex', alignItems: 'center', gap: G.fieldGap, opacity: CONTROL_OPACITY[emphasis],
      textTransform: 'uppercase', color: state === YesNo.ON ? style.primaryColor : hexToRgba(style.textColor, O.high)}}>
    {form === 'setting' ? <BooleanControl {...common} form={BooleanForm.SETTING} label={label}/>
      : <><BooleanControl {...common} {...(form === 'switch'
        ? {form: BooleanForm.SWITCH, ariaLabel: label, height: G.yesNoDot} : {form: BooleanForm.CELL, label})}/>
        <span style={T.moduleLabel}>{label}</span></>}
  </div>;
}

/** Solid is on, a ring is off, dotted is not set, and half filled is inherit. */
export function YesNoDot({state, color}: {state: YesNoValue; color: string}) {
  const size = G.yesNoDot, centre = size / 2, r = centre - G.yesNoStroke;
  const settled = state === YesNo.ON || state === YesNo.OFF;
  return <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`}
    style={{flex: 'none', display: 'block'}}>
    <circle cx={centre} cy={centre} r={r} fill={state === YesNo.ON ? color : 'none'}
      stroke={hexToRgba(color, settled ? O.full : O.high)} strokeWidth={G.yesNoStroke}
      strokeDasharray={state === YesNo.UNSET ? `${G.yesNoDash} ${G.yesNoDash}` : undefined} strokeLinecap="round"/>
    {state === YesNo.INHERIT &&
      <path d={`M${centre} ${centre - r}A${r} ${r} 0 0 0 ${centre} ${centre + r}Z`} fill={color}/>}
  </svg>;
}

function DotYesNo({label, state, emphasis, onPress, title}: Props) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, locked = emphasis === FieldEmphasis.INERT || !onPress;
  return <button type="button" role="switch" aria-checked={state === YesNo.ON} aria-label={label}
    data-module-field={label} data-field-emphasis={emphasis} data-yes-no={state}
    title={title} disabled={locked} onClick={onPress}
    style={{...T.moduleLabel, display: 'flex', alignItems: 'center', gap: G.fieldGap, maxWidth: '100%',
      minHeight: G.yesNoLine, padding: 0, border: 'none', background: 'transparent', textAlign: 'left',
      textTransform: 'uppercase', cursor: locked ? 'default' : 'pointer',
      color: set ? style.primaryColor : hexToRgba(style.textColor, O.high)}}>
    <span style={{display: 'flex', opacity: CONTROL_OPACITY[emphasis], transition: TransitionKeys.fast}}>
      <YesNoDot state={state} color={style.primaryColor}/>
    </span>
    <span data-field-name style={{minWidth: 0, overflowWrap: 'anywhere'}}>{label}</span>
  </button>;
}
