import React from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {hexToRgba} from '../../color.ts';
import {D, O, T, TransitionKeys} from '../../synth/design/index.ts';
import {FieldEmphasis, YesNo, type FieldEmphasisValue, type YesNoValue} from '../../fields.ts';
import {skinFormOrDefault} from '../../skinForms.ts';
import {SkinDefault, YesNoSkinForm} from '../../skinKinds.ts';
import {Boolean as BooleanControl, BooleanForm} from '../../synth/components/synth/Boolean.tsx';
import {SWITCH_WIDTH_RATIO} from './SwitchBoolean.tsx';
import {FIELD_LINE} from '../grid/fieldLine.ts';
const G = D.moduleGrid;
const CONTROL_OPACITY = {set: O.full, quiet: O.medium, inert: O.medium};
interface Props {
  label: string; state: YesNoValue; emphasis: FieldEmphasisValue; onPress?: () => void;
  title?: string; appearance?: string;
}
export function ModuleYesNo(props: Props) {
  const context = useStyle(), style = context.getEffectiveStyle();
  const form = props.appearance ?? skinFormOrDefault(context.skin, SkinDefault.YES_NO);
  const {state, label, onPress, emphasis, title} = props;
  // A skin's switches are wider than its dots: the dots keep the switch's width so every name starts on one line.
  const slot = form === YesNoSkinForm.SWITCH ? G.yesNoDot * SWITCH_WIDTH_RATIO : G.yesNoDot;
  if (form === YesNoSkinForm.DOT || state === YesNo.UNSET || state === YesNo.INHERIT) {
    return <DotYesNo {...props} slot={slot}/>;
  }
  const disabled = !onPress || emphasis === FieldEmphasis.INERT;
  const common = {value: state === YesNo.ON, onChange: () => onPress?.(), disabled};
  return <div data-module-field={label} data-yes-no={state} data-yes-no-form={form} title={title}
    style={{display: 'flex', alignItems: 'center', gap: G.fieldGap, opacity: CONTROL_OPACITY[emphasis],
      textTransform: 'uppercase', color: state === YesNo.ON ? style.primaryColor : hexToRgba(style.textColor, O.high)}}>
    {form === YesNoSkinForm.SETTING ? <BooleanControl {...common} form={BooleanForm.SETTING} label={label}/>
      : <><BooleanControl {...common} {...(form === YesNoSkinForm.SWITCH
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

/** A module's power dot: its dot alone in the header, pressed to turn the module on or off. */
export function PowerDot({state, ariaLabel, onPress, title}: {
  state: YesNoValue; ariaLabel: string; onPress: () => void; title?: string;
}) {
  const color = useStyle().getEffectiveStyle().primaryColor;
  return <button type="button" role="switch" aria-checked={state === YesNo.ON} aria-label={ariaLabel}
    data-power-dot={state} title={title} onClick={onPress} style={{display: 'flex', flex: 'none', padding: 0,
      border: 'none', background: 'transparent', cursor: 'pointer', transition: TransitionKeys.fast}}>
    <YesNoDot state={state} color={color}/>
  </button>;
}

function DotYesNo({label, state, emphasis, onPress, title, slot}: Props & {slot: number}) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, locked = emphasis === FieldEmphasis.INERT || !onPress;
  return <button type="button" role="switch" aria-checked={state === YesNo.ON} aria-label={label}
    data-module-field={label} data-field-emphasis={emphasis} data-yes-no={state}
    title={title} disabled={locked} onClick={onPress}
    style={{...T.moduleLabel, ...FIELD_LINE, padding: 0, border: 'none', background: 'transparent',
      textAlign: 'left', textTransform: 'uppercase', cursor: locked ? 'default' : 'pointer',
      color: set ? style.primaryColor : hexToRgba(style.textColor, O.high)}}>
    <span style={{display: 'flex', justifyContent: 'center', flex: 'none', width: slot,
      opacity: CONTROL_OPACITY[emphasis], transition: TransitionKeys.fast}}>
      <YesNoDot state={state} color={style.primaryColor}/>
    </span>
    <span data-field-name style={{minWidth: 0, overflowWrap: 'anywhere'}}>{label}</span>
  </button>;
}
