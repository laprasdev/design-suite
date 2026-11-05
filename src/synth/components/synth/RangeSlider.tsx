import React, {useRef, useState} from 'react';
import {useStyle} from '../../StyleContext.tsx';
import {getColorScheme, hexToRgba, resolveColorType, type AnyColor} from '../../../color.ts';
import {Borders} from '../../../tokens.ts';
import {O} from '../../design/index.ts';
import {useOwnedControlGesture as useControlGesture} from '../../../react/inputs/useOwnedControlGesture.ts';
import {VALUE_THICKNESS, type ModulationProps} from './modulation.ts';
import {ModulationTracks, modulationTrackHeight} from '../../../react/inputs/ModulationTracks.tsx';
import {skinForm} from '../../../skinForms.ts';

// A range as one rounded bar on a track you can see, with a dot at each end you can move. Each modulator is a thinner line above the end it moves, pointing where the value goes.
const HIT_PADDING = 6;
const NEAR_END_PX = 10;
const THUMB_SIZE = 14;
const THUMB_DOT = THUMB_SIZE / 2;
const BAR_GLOW = 6;
const Grip = Object.freeze({LOW: 'low', HIGH: 'high', BOTH: 'both'} as const);
type GripValue = typeof Grip[keyof typeof Grip];

export interface RangeSliderProps extends ModulationProps {
  appearance?: 'minimal' | 'line' | 'track' | 'setting';
  low: number;
  high: number;
  min: number;
  max: number;
  onChange?: (low: number, high: number) => void;
  step?: number;
  /** A duration: the origin stays at min and only the end moves. */
  singleEnded?: boolean;
  disabled?: boolean;
  /** The most a pixel of drag moves an end. Where the track is coarser than that, a drag moves the end from where it was pressed at this rate rather than following the pointer. */
  perPixel?: number;
  /** The range isn't set, so it draws as an outline with no glow, as any field that isn't set reads, and still takes a drag that sets it. */
  quiet?: boolean;
  color?: AnyColor;
  ariaLabel: string;
}

const decimalsOf = (unit: number) => (String(unit).split('.')[1] ?? '').length;
/** A value on whole units of `unit`, through the unit's own decimals, so a tenth is written as a tenth and not 16.000000000000004. */
export const onUnit = (value: number, unit: number) => Number((Math.round(value / unit) * unit).toFixed(decimalsOf(unit)));

export function RangeSlider({appearance, low, high, min, max, onChange, step = 0, singleEnded = false, disabled = false, perPixel, quiet = false, color, ariaLabel, modulators = [], selectedSource, onSelectSource}: RangeSliderProps) {
  const context = useStyle(), style = context.getEffectiveStyle();
  const visual = appearance ?? (singleEnded ? skinForm(context.skin, 'slider') : undefined) ?? 'track';
  const flat = visual === 'minimal' || visual === 'line';
  const thickness = visual === 'minimal' ? 1 : visual === 'line' ? 3 : VALUE_THICKNESS;
  const scheme = getColorScheme(resolveColorType(color), style);
  const track = useRef<HTMLDivElement>(null);
  // `fine` holds where the press landed and what the end held then, for a track too coarse to follow the pointer.
  const drag = useRef<{grip: GripValue; low: number; high: number; start: number; fine: {x: number; value: number} | null} | null>(null);
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);
  // A drag is one undo step: it begins on the press, before a press away from an end moves it, and ends on release.
  const gesture = useControlGesture();
  const release = () => {
    if (drag.current) gesture.end();
    drag.current = null;
    setActive(false);
  };
  const span = max - min;
  const clamp = (value: number) => Math.min(max, Math.max(min, value));
  const percent = (value: number) => (clamp(value) - min) / span * 100;
  const snap = (value: number) => (step > 0 ? onUnit(value, step) : value);
  const valueAt = (clientX: number) => {
    const box = track.current!.getBoundingClientRect();
    return min + Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span;
  };
  // A press on an end grabs it where it is. Anywhere else the end jumps there first, and the fine drag starts from that.
  const nearEnd = (clientX: number, value: number) => Math.abs(clientX - track.current!.getBoundingClientRect().left - percent(value) / 100 * track.current!.getBoundingClientRect().width) <= NEAR_END_PX;
  const coarse = () => perPixel !== undefined && span / track.current!.getBoundingClientRect().width > perPixel;
  const gripAt = (clientX: number): GripValue => {
    if (singleEnded) return Grip.HIGH;
    const box = track.current!.getBoundingClientRect(), x = clientX - box.left;
    const lowX = percent(low) / 100 * box.width, highX = percent(high) / 100 * box.width;
    if (Math.abs(x - lowX) <= NEAR_END_PX && Math.abs(x - lowX) <= Math.abs(x - highX)) return Grip.LOW;
    if (Math.abs(x - highX) <= NEAR_END_PX) return Grip.HIGH;
    if (x > lowX && x < highX) return Grip.BOTH;
    return x <= lowX ? Grip.LOW : Grip.HIGH;
  };
  const applyDrag = (clientX: number) => {
    const held = drag.current;
    if (!held) return;
    const value = held.fine ? clamp(held.fine.value + (clientX - held.fine.x) * perPixel!) : valueAt(clientX);
    if (held.grip === Grip.LOW) onChange?.(Math.min(snap(value), high), high);
    else if (held.grip === Grip.HIGH) onChange?.(low, Math.max(snap(value), low));
    else {
      const moved = held.fine ? value - held.fine.value : value - held.start;
      const shift = Math.min(max - held.high, Math.max(min - held.low, snap(moved)));
      onChange?.(snap(held.low + shift), snap(held.high + shift));
    }
  };
  // An arrow moves one step, or a hundredth of the range where there's no step, and lands on that unit as a drag does.
  const nudge = (grip: typeof Grip.LOW | typeof Grip.HIGH) => (event: React.KeyboardEvent) => {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!direction || disabled) return;
    event.preventDefault();
    const unit = step || span / 100;
    if (grip === Grip.LOW) onChange?.(Math.min(high, clamp(onUnit(low + direction * unit, unit))), high);
    else onChange?.(low, Math.max(low, clamp(onUnit(high + direction * unit, unit))));
  };
  const lit = (active || hovered) && !disabled;
  const topRoom = modulationTrackHeight(modulators.length, thickness);
  const thumb = (grip: typeof Grip.LOW | typeof Grip.HIGH, value: number, label: string, lowest: number, highest: number) => (
    <div role="slider" tabIndex={disabled ? -1 : 0} aria-label={`${ariaLabel} ${label}`} aria-valuemin={lowest} aria-valuemax={highest} aria-valuenow={value} onKeyDown={nudge(grip)}
      onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
      style={{position: 'absolute', left: `${percent(value)}%`, bottom: HIT_PADDING + thickness / 2, width: THUMB_SIZE, height: THUMB_SIZE, transform: 'translate(-50%, 50%)', outline: 'none', display: 'grid', placeItems: 'center'}}>
      {!disabled && <span aria-hidden style={{width: flat ? (visual === 'minimal' ? 2 : 6) : THUMB_DOT, height: flat ? 12 : THUMB_DOT, borderRadius: flat ? 0 : '50%', boxSizing: 'border-box', background: quiet ? style.cutoutBackground : scheme.main, border: quiet ? `${Borders.standard.width}px dashed ${scheme.main}` : 'none', boxShadow: flat || quiet || !lit ? 'none' : `0 0 ${BAR_GLOW}px ${scheme.glow}`}}/>}
    </div>
  );
  return (
    <div ref={track} data-range-slider data-slider-appearance={visual} style={{position: 'relative', flex: 1, minWidth: 0, height: HIT_PADDING * 2 + thickness + topRoom, cursor: disabled ? 'not-allowed' : 'ew-resize', touchAction: 'none', userSelect: 'none'}}
      onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}
      onPointerDown={event => {
        if (disabled) return;
        gesture.begin();
        event.currentTarget.setPointerCapture(event.pointerId);
        const grip = gripAt(event.clientX), start = valueAt(event.clientX);
        const held = grip === Grip.LOW ? low : high;
        const grabbed = grip === Grip.BOTH || nearEnd(event.clientX, held);
        drag.current = {grip, low, high, start, fine: coarse() ? {x: event.clientX, value: grip === Grip.BOTH ? start : grabbed ? held : start} : null};
        setActive(true);
        if (grip !== Grip.BOTH && !grabbed) applyDrag(event.clientX);
      }}
      onPointerMove={event => applyDrag(event.clientX)}
      onPointerUp={release}
      onPointerCancel={release}>
      <div data-range-track style={{position: 'absolute', left: 0, right: 0, bottom: HIT_PADDING, height: thickness, borderRadius: thickness, background: hexToRgba(scheme.main, disabled ? O.ghost : O.faint)}}/>
      <div data-range-bar data-range-quiet={quiet || undefined} style={{position: 'absolute', left: `${percent(singleEnded ? min : low)}%`, width: `${percent(high) - percent(singleEnded ? min : low)}%`, bottom: HIT_PADDING, height: thickness, borderRadius: thickness, boxSizing: 'border-box',
        background: disabled ? hexToRgba(scheme.main, O.low) : quiet ? 'transparent' : scheme.main, border: quiet && !disabled ? `${Borders.standard.width}px dashed ${scheme.main}` : 'none',
        boxShadow: flat || disabled || quiet ? 'none' : `0 0 ${lit ? BAR_GLOW * 2 : BAR_GLOW}px ${scheme.glow}`, transition: 'box-shadow .17s ease'}}/>
      {!singleEnded && thumb(Grip.LOW, low, 'origin', min, high)}
      {thumb(Grip.HIGH, high, 'end', low, max)}
      {!disabled && <ModulationTracks modulators={modulators} selectedSource={selectedSource}
        onSelectSource={onSelectSource} low={low} high={high} min={min} max={max}
        thickness={thickness} bottom={HIT_PADDING}/>}
    </div>
  );
}
