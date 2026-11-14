import {SettingSlider, SkinRangeSlider, type SettingSliderProps} from '../../../react/inputs/SettingSlider.tsx';
import {SliderForm} from '../../../react/inputs/sliderForm.ts';
export {SliderForm};
import {skinFormOrDefault} from '../../../skinForms.ts';
import {SkinDefault, SliderSkinForm as SkinSliderForm} from '../../../skinKinds.ts';
import {ModulationTracks} from '../../../react/inputs/ModulationTracks.tsx';
import type {SliderModulationProps} from './modulation.ts';
import React from 'react';
import {SliderTrack, SLIDER_TRACK_HEIGHT as TRACK_HEIGHT} from '../../../react/inputs/SliderTrack.tsx';
import {SliderProgress, type SliderProgressProps} from '../../../react/inputs/SliderProgress.tsx';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, resolveColorType, getKnobGradient, hexToRgba, type AnyColor } from '../../../color.ts';
import { D, F, C, O, T, TransitionKeys, P } from '../../design/index.ts';
import { useControlBehavior } from './base/index.ts';
import { useTooltipSafe } from './TooltipContext.tsx';
import {HoverDetail} from '../../../react/HoverDetail.tsx';
import {ResetIcon} from '../../../react/HeaderIconButton.tsx';
import {type RangeSliderProps} from './RangeSlider.tsx';

// =====================================================
// SLIDER - Compact horizontal fader (knob aesthetic)
// =====================================================


const FADER_WIDTH = 6;
const FADER_HEIGHT = 12;
const DEFAULT_WIDTH = 100;

export interface SliderProps extends SliderModulationProps {
  form?: typeof SliderForm.CELL | typeof SliderForm.THIN;
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
  /** Value per pixel dragged. Defaults to the drag behaviour's own. */
  sensitivity?: number;
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function SliderFill({ fraction, zeroFraction, color, glow, active, thin }: {
  fraction: number; zeroFraction: number; color: string; glow: string; active: boolean; thin: boolean;
}) {
  const left = Math.min(fraction, zeroFraction);
  const width = Math.abs(fraction - zeroFraction);
  return (
    <div style={{
      position: P.absolute as 'absolute', top: '50%', transform: 'translateY(-50%)',
      left: `${left * 100}%`, width: `${width * 100}%`, height: thin ? 1 : D.knob.strokeThin,
      background: color, borderRadius: D.knob.strokeThin,
      boxShadow: active && !thin ? `0 0 ${D.knob.glowSmall}px ${glow}` : 'none',
      transition: TransitionKeys.fast
    }} />
  );
}

function SliderFader({ fraction, scheme, style, active, thin }: {
  fraction: number; scheme: ReturnType<typeof getColorScheme>;
  style: any; active: boolean; thin: boolean;
}) {
  const glow = active ? `, 0 0 ${D.knob.glowSmall}px ${scheme.glow}` : '';
  return (
    <div style={{
      position: P.absolute as 'absolute', top: '50%',
      left: `${fraction * 100}%`, transform: 'translate(-50%, -50%)',
      width: thin ? 2 : FADER_WIDTH, height: FADER_HEIGHT, borderRadius: thin ? 0 : D.radius.tiny,
      background: thin ? scheme.main : getKnobGradient(style),
      border: thin ? 'none' : `1px solid ${scheme.inner}`,
      boxShadow: thin ? 'none' : `0 1px 3px rgba(0,0,0,0.5), inset 0 1px 2px ${scheme.inner}${glow}`,
      transition: TransitionKeys.fast
    }} />
  );
}

// =====================================================
// SLIDER COMPONENT
// =====================================================

export function Slider(
 props: SliderProps|SettingSliderProps|SliderProgressProps|(RangeSliderProps&{form:typeof SliderForm.RANGE})
) {
  if(props.form===SliderForm.PROGRESS) return <SliderProgress {...props}/>;
  if('form' in props&&props.form===SliderForm.RANGE) return <SkinRangeSlider {...props}/>;
  return 'form' in props&&props.form===SliderForm.SETTING?<SettingSlider {...props}/>:<CellSlider {...props as SliderProps}/>;
}

function CellSlider({ form, value, onChange, min: minProp = 0, max, label, color, disabled, tooltip, isInteger, width, fill, className, sensitivity, modulators = [], modulationDisplay, selectedSource, onSelectSource }: SliderProps) {
  const { getEffectiveStyle, skin } = useStyle();
  const style = getEffectiveStyle();
  const { setTooltip } = useTooltipSafe();

  const colorType = resolveColorType(color);
  const scheme = getColorScheme(colorType, style);
  const trackWidth: number | '100%' = fill ? '100%' : (width ?? DEFAULT_WIDTH);
  const range = max - minProp;
  const fraction = range > 0 ? Math.min(Math.max((value - minProp) / range, 0), 1) : 0;
  const zeroFraction = range > 0 ? Math.min(Math.max((0 - minProp) / range, 0), 1) : 0;

  const { isDragging, isHovered, setIsHovered, handleMouseDown, handlePointerDown } = useControlBehavior(
    value, onChange, { min: minProp, max, vertical: false, isInteger, disabled, sensitivity }
  );

  const active = isDragging || isHovered;
  const skinThin = !form && skinFormOrDefault(skin, SkinDefault.SLIDER) === SkinSliderForm.MINIMAL;
  const thin = form === SliderForm.THIN || skinThin;
  const thickness = thin ? 1 : TRACK_HEIGHT;

  const fillStyle = fill ? { flex: 1, minWidth: 0 } as const : {};
  return (
    <div
      className={className} data-slider-form={form ?? SliderForm.CELL}
      style={{ display: F.flex, alignItems: F.center, gap: D.spacing.microGap, cursor: disabled ? C.notAllowed : C.pointer, ...fillStyle }}
      onMouseEnter={() => { setIsHovered(true); tooltip && setTooltip(tooltip); }}
      onMouseLeave={() => { setIsHovered(false); tooltip && setTooltip(null); }}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      onDoubleClick={() => !disabled && onChange?.(minProp)}
    >
      <div style={{ position: P.relative as 'relative', height: FADER_HEIGHT + D.spacing.microGap, display: F.flex, alignItems: F.center, ...(fill ? { flex: 1 } : { width: trackWidth }) }}>
        {!disabled && <ModulationTracks low={minProp} high={value} min={minProp} max={max}
          thickness={thickness} bottom={(FADER_HEIGHT + D.spacing.microGap - thickness) / 2}
          modulators={modulators} modulationDisplay={modulationDisplay} selectedSource={selectedSource}
          onSelectSource={onSelectSource}/>}
        <SliderTrack background={hexToRgba(style.knobGradient.at(-1)!, O.high)}
          width={fill ? '100%' : trackWidth} thin={thin} />
        <SliderFill fraction={fraction} zeroFraction={zeroFraction} color={scheme.main} glow={scheme.glow} active={active} thin={thin} />
        <SliderFader fraction={fraction} scheme={scheme} style={style} active={active} thin={thin} />
      </div>
    </div>
  );
}
