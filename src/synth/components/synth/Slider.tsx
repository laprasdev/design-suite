import React from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, resolveColorType, getKnobGradient, hexToRgba, type AnyColor } from '../../../color.ts';
import { D, F, C, O, T, TransitionKeys, P } from '../../design/index.ts';
import { useControlBehavior } from './base/index.ts';
import { useTooltipSafe } from './TooltipContext.tsx';
import {HoverDetail} from '../../../react/HoverDetail.tsx';
import {ResetIcon} from '../../../react/HeaderIconButton.tsx';

// =====================================================
// SLIDER - Compact horizontal fader (knob aesthetic)
// =====================================================

const TRACK_HEIGHT = 3;
const FADER_WIDTH = 6;
const FADER_HEIGHT = 12;
const DEFAULT_WIDTH = 100;

export interface SliderProps {
  form?: typeof SliderForm.CELL;
  value: number;
  onChange?: (v: number) => void;
  min?: number;
  max: number;
  label?: string;
  color?: AnyColor;
  disabled?: boolean;
  tooltip?: string;
  isInteger?: boolean;
  width?: number;
  fill?: boolean;
  className?: string;
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function SliderTrack({ color, width }: { color: string; width: number | '100%' }) {
  return (
    <div style={{
      width, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT,
      background: hexToRgba(color, O.high),
      position: P.absolute as 'absolute', top: '50%', transform: 'translateY(-50%)'
    }} />
  );
}

function SliderFill({ fraction, zeroFraction, color, glow, active }: {
  fraction: number; zeroFraction: number; color: string; glow: string; active: boolean;
}) {
  const left = Math.min(fraction, zeroFraction);
  const width = Math.abs(fraction - zeroFraction);
  return (
    <div style={{
      position: P.absolute as 'absolute', top: '50%', transform: 'translateY(-50%)',
      left: `${left * 100}%`, width: `${width * 100}%`, height: D.knob.strokeThin,
      background: color, borderRadius: D.knob.strokeThin,
      boxShadow: active ? `0 0 ${D.knob.glowSmall}px ${glow}` : 'none',
      transition: TransitionKeys.fast
    }} />
  );
}

function SliderFader({ fraction, scheme, style, active }: {
  fraction: number; scheme: ReturnType<typeof getColorScheme>;
  style: any; active: boolean;
}) {
  const glow = active ? `, 0 0 ${D.knob.glowSmall}px ${scheme.glow}` : '';
  return (
    <div style={{
      position: P.absolute as 'absolute', top: '50%',
      left: `${fraction * 100}%`, transform: 'translate(-50%, -50%)',
      width: FADER_WIDTH, height: FADER_HEIGHT, borderRadius: D.radius.tiny,
      background: getKnobGradient(style),
      border: `1px solid ${scheme.inner}`,
      boxShadow: `0 1px 3px rgba(0,0,0,0.5), inset 0 1px 2px ${scheme.inner}${glow}`,
      transition: TransitionKeys.fast
    }} />
  );
}

// =====================================================
// SLIDER COMPONENT
// =====================================================

// One slider, two forms: a bare track for a module's grid, or a labelled row with its written value and a reset.
export const SliderForm=Object.freeze({CELL:'cell',SETTING:'setting'} as const);
export interface SettingSliderProps {
  form: typeof SliderForm.SETTING;
  label: string;
  detail?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange(value: number): void;
  resetLabel: string;
  format?: (value: number)=>React.ReactNode;
  compact?: boolean;
}
function SettingSlider({label,detail,value,min,max,step,defaultValue,onChange,resetLabel,format=String,compact=false}: SettingSliderProps) {
 const changed=value!==defaultValue;
 return <div className="range-control" data-compact={compact||undefined} data-changed={changed}>
  {!compact&&<span className="range-control-label">{detail?<HoverDetail label={label} content={detail}>{label}</HoverDetail>:label}</span>}
  <input type="range" min={min} max={max} step={step} value={value} aria-label={label} title={compact?detail:undefined} onChange={event=>onChange(Number(event.target.value))}/>
  <output>{format(value)}</output>
  <button type="button" className="range-control-reset" aria-label={resetLabel} title={resetLabel} disabled={!changed} onClick={()=>onChange(defaultValue)}><ResetIcon/></button>
 </div>;
}

export function Slider(props: SliderProps|SettingSliderProps) {
  return 'form' in props&&props.form===SliderForm.SETTING?<SettingSlider {...props}/>:<CellSlider {...props as SliderProps}/>;
}

function CellSlider({ value, onChange, min: minProp = 0, max, label, color, disabled, tooltip, isInteger, width, fill, className }: SliderProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  const { setTooltip } = useTooltipSafe();

  const colorType = resolveColorType(color);
  const scheme = getColorScheme(colorType, style);
  const trackWidth: number | '100%' = fill ? '100%' : (width ?? DEFAULT_WIDTH);
  const range = max - minProp;
  const fraction = range > 0 ? Math.min(Math.max((value - minProp) / range, 0), 1) : 0;
  const zeroFraction = range > 0 ? Math.min(Math.max((0 - minProp) / range, 0), 1) : 0;

  const { isDragging, isHovered, setIsHovered, handleMouseDown } = useControlBehavior(
    value, onChange, { min: minProp, max, vertical: false, isInteger, disabled }
  );

  const active = isDragging || isHovered;

  const fillStyle = fill ? { flex: 1, minWidth: 0 } as const : {};
  return (
    <div
      className={className}
      style={{ display: F.flex, alignItems: F.center, gap: D.spacing.microGap, cursor: disabled ? C.notAllowed : C.pointer, ...fillStyle }}
      onMouseEnter={() => { setIsHovered(true); tooltip && setTooltip(tooltip); }}
      onMouseLeave={() => { setIsHovered(false); tooltip && setTooltip(null); }}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => !disabled && onChange?.(minProp)}
    >
      <div style={{ position: P.relative as 'relative', height: FADER_HEIGHT + D.spacing.microGap, display: F.flex, alignItems: F.center, ...(fill ? { flex: 1 } : { width: trackWidth }) }}>
        <SliderTrack color={style.knobGradient.at(-1)!} width={fill ? '100%' : trackWidth} />
        <SliderFill fraction={fraction} zeroFraction={zeroFraction} color={scheme.main} glow={scheme.glow} active={active} />
        <SliderFader fraction={fraction} scheme={scheme} style={style} active={active} />
      </div>
    </div>
  );
}
