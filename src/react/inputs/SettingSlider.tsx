import React, {useEffect} from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {skinForm} from '../../skinForms.ts';
import {useOwnedControlGesture as useControlGesture} from './useOwnedControlGesture.ts';
import {RangeSlider, type RangeSliderProps} from '../../synth/components/synth/RangeSlider.tsx';
import type {SettingSliderProps} from '../../synth/components/synth/Slider.tsx';
import {ModulationTracks, modulationTrackHeight} from './ModulationTracks.tsx';
import {HoverDetail} from '../HoverDetail.tsx';
import {ResetIcon} from '../HeaderIconButton.tsx';
const TRACK_HEIGHT = 3, FADER_HEIGHT = 12;

export function SkinRangeSlider(props: RangeSliderProps) {
  const {skin} = useStyle(), form = props.appearance ?? skinForm(skin, 'slider');
  if (!props.singleEnded || props.quiet || form !== 'setting') return <RangeSlider {...props}/>;
  return <SettingSlider form="setting" label={props.ariaLabel ?? 'Value'} value={props.high}
    min={props.min} max={props.max} step={props.step || 'any'} disabled={props.disabled}
    onChange={value => props.onChange?.(props.low, value)} modulators={props.modulators}
    selectedSource={props.selectedSource} onSelectSource={props.onSelectSource}/>;
}

export function SettingSlider({label, detail, value, min, max, step, defaultValue, onChange, resetLabel,
  format = String, compact = false, modulators, selectedSource, onSelectSource, disabled}: SettingSliderProps) {
  const gesture = useControlGesture(), changed = defaultValue !== undefined && value !== defaultValue;
  useEffect(() => gesture.end, [gesture]);
  const topRoom = modulationTrackHeight(modulators?.length ?? 0, TRACK_HEIGHT);
  const input = <input type="range" disabled={disabled} onFocus={gesture.begin} onBlur={gesture.end}
    min={min} max={max} step={step} value={value} aria-label={label} title={compact ? detail : undefined}
    onChange={event => onChange(Number(event.target.value))}/>;
  return <div className="range-control" data-compact={compact || undefined} data-changed={changed}>
    {!compact && <span className="range-control-label">
      {detail ? <HoverDetail label={label} content={detail}>{label}</HoverDetail> : label}
    </span>}
    {modulators?.length ? <div className="range-control-track"
      style={{position: 'relative', minWidth: 0, gridArea: 'slider', paddingTop: topRoom}}>
      <ModulationTracks low={min} high={value} min={min} max={max} thickness={TRACK_HEIGHT}
        bottom={FADER_HEIGHT / 2} modulators={modulators} selectedSource={selectedSource}
        onSelectSource={onSelectSource}/>
      {input}
    </div> : input}
    <output>{format(value)}</output>
    {defaultValue !== undefined && <button type="button" className="range-control-reset"
      aria-label={resetLabel} title={resetLabel} disabled={disabled || !changed} onClick={() => onChange(defaultValue)}>
      <ResetIcon/>
    </button>}
  </div>;
}
