import React, {useEffect} from 'react';
import { SETTING_RANGE } from './settingSliderParts.ts';
import {useStyle} from '../../synth/StyleContext.tsx';
import {skinForm} from '../../skinForms.ts';
import {SkinKind, SliderSkinForm} from '../../skinKinds.ts';
import {useOwnedControlGesture as useControlGesture} from './useOwnedControlGesture.ts';
import {useControlBehavior} from '../../synth/components/synth/base/useControlBehavior.ts';
import {RangeSlider, type RangeSliderProps} from '../../synth/components/synth/RangeSlider.tsx';
import type {SliderModulationProps} from '../../synth/components/synth/modulation.ts';
import {SliderForm} from './sliderForm.ts';
import {ModulationTracks, modulationRoom} from './ModulationTracks.tsx';
import {HoverDetail} from '../HoverDetail.tsx';
import {ResetIcon} from '../HeaderIconButton.tsx';
import {SLIDER_TRACK_HEIGHT} from './SliderTrack.tsx';
/** The setting's thumb, and so the height of its input: a block as tall as the thumb, with the track through the
 *  middle, so a line anchored to the input is anchored to the track and clears the thumb. controls.css draws the
 *  browser's track and thumb at exactly these sizes, from the variables below. */
const SETTING_THUMB = 16;
const percentOf = (value: number, min: number, max: number) => max > min ? (value - min) / (max - min) * 100 : 0;
const inputStyle = (value: number, min: number, max: number): React.CSSProperties => ({display: 'block',
  height: SETTING_THUMB, '--range-track': `${SLIDER_TRACK_HEIGHT}px`, '--range-thumb': `${SETTING_THUMB}px`,
  '--range-fill': `${percentOf(value, min, max)}%`} as React.CSSProperties);

export interface SettingSliderProps extends SliderModulationProps {
  form: typeof SliderForm.SETTING;
  label: string;
  detail?: string;
  value: number;
  min: number;
  max: number;
  step: number | 'any';
  defaultValue?: number;
  onChange(value: number): void;
  resetLabel?: string;
  disabled?: boolean;
  format?: (value: number)=>React.ReactNode;
  compact?: boolean;
  /** A drag moves the value this far a pixel from where it was pressed, like the cell form's, in place of the
   *  track's absolute position; a range with more steps than the track has pixels can then still land on each. */
  sensitivity?: number;
}
export function SkinRangeSlider(props: RangeSliderProps) {
  const {skin} = useStyle(), form = props.appearance ?? skinForm(skin, SkinKind.SLIDER);
  if (!props.singleEnded || props.quiet || form !== SliderSkinForm.SETTING) return <RangeSlider {...props}/>;
  return <SettingSlider form={SliderSkinForm.SETTING} label={props.ariaLabel ?? 'Value'} value={props.high}
    min={props.min} max={props.max} step={props.step || 'any'} disabled={props.disabled}
    onChange={value => props.onChange?.(props.low, value)} modulators={props.modulators}
    modulationDisplay={props.modulationDisplay} selectedSource={props.selectedSource}
    onSelectSource={props.onSelectSource}/>;
}

export function SettingSlider({label, detail, value, min, max, step, defaultValue, onChange, resetLabel,
  format = String, compact = false, sensitivity, modulators, modulationDisplay, selectedSource, onSelectSource,
  disabled}: SettingSliderProps) {
  const gesture = useControlGesture(), changed = defaultValue !== undefined && value !== defaultValue;
  useEffect(() => gesture.end, [gesture]);
  const drag = useControlBehavior(value, onChange, {min, max, sensitivity, vertical: false, disabled});
  const relative = sensitivity === undefined ? {}
    : {onMouseDown: drag.handleMouseDown, onPointerDown: drag.handlePointerDown};
  // Where the track sits beside its value (compact) nothing may move it, so the lines get no room above it there.
  const topRoom = compact ? 0 : modulationRoom(modulationDisplay, modulators?.length ?? 0, SLIDER_TRACK_HEIGHT);
  const input = <input type="range" {...{ [SETTING_RANGE]: true }}
    style={inputStyle(value, min, max)} disabled={disabled}
    onFocus={gesture.begin} onBlur={gesture.end} {...relative}
    min={min} max={max} step={step} value={value} aria-label={label} title={compact ? detail : undefined}
    onChange={event => onChange(Number(event.target.value))}/>;
  return <div className="range-control" data-compact={compact || undefined} data-changed={changed}>
    {!compact && <span className="range-control-label">
      {detail ? <HoverDetail label={label} content={detail}>{label}</HoverDetail> : label}
    </span>}
    {modulators?.length ? <div className="range-control-track"
      style={{position: 'relative', minWidth: 0, gridArea: 'slider', paddingTop: topRoom}}>
      {/* The thumb's centre travels from half a thumb in, so the parts sit over that span. */}
      <div style={{position: 'absolute', inset: `0 ${SETTING_THUMB / 2}px`, pointerEvents: 'none'}}>
        <ModulationTracks low={min} high={value} min={min} max={max} thickness={SLIDER_TRACK_HEIGHT}
          bottom={(SETTING_THUMB - SLIDER_TRACK_HEIGHT) / 2} thumb={SETTING_THUMB}
          modulators={modulators} modulationDisplay={modulationDisplay} selectedSource={selectedSource}
          onSelectSource={onSelectSource}/>
      </div>
      {input}
    </div> : input}
    <output>{format(value)}</output>
    {defaultValue !== undefined && <button type="button" className="range-control-reset"
      aria-label={resetLabel} title={resetLabel} disabled={disabled || !changed} onClick={() => onChange(defaultValue)}>
      <ResetIcon/>
    </button>}
  </div>;
}
