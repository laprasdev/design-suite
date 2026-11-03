import React, {useRef, useState} from 'react';
import {useStyle} from '../../StyleContext.tsx';
import {LayoutDimensions} from '../../../layout.ts';
import {getColorScheme, hexToRgba, resolveColorType, type AnyColor} from '../../../color.ts';
import {Borders} from '../../../tokens.ts';
import {O} from '../../design/index.ts';
import {useControlGesture} from './base/useControlBehavior.ts';
import {MODULATOR_LIVE_COLOR, RangeEnd, VALUE_THICKNESS, modulationLadder, modulatorColor, modulatorOpacity, type ControlModulator, type ModulationProps} from './modulation.ts';

// A range as one rounded bar on a track you can see, with a dot at each end you can move. Each modulator is a thinner line above the end it moves, pointing where the value goes.
const HIT_PADDING = 6;
const NEAR_END_PX = 10;
const THUMB_SIZE = 14;
const THUMB_DOT = THUMB_SIZE / 2;
const LINE_HIT_HEIGHT = 7;
const LIVE_SCALE = 2.4;
const CHEVRON_HEIGHT = 6;
const CHEVRON_WIDTH = 3;
const NUMERAL_SIZE = LayoutDimensions.moduleGrid.ringNumeralSize;
const NUMERAL_OFFSET = 8;
const BAR_GLOW = 6;
const LINE_GLOW = 3;
const Grip = Object.freeze({LOW: 'low', HIGH: 'high', BOTH: 'both'} as const);
type GripValue = typeof Grip[keyof typeof Grip];

export interface RangeSliderProps extends ModulationProps {
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

function Chevron({at, pointsUp, color, width}: {at: number; pointsUp: boolean; color: string; width: number}) {
  const tip = pointsUp ? CHEVRON_WIDTH : -CHEVRON_WIDTH;
  return <svg width={CHEVRON_WIDTH * 2} height={CHEVRON_HEIGHT + width} style={{position: 'absolute', left: `${at}%`, top: '50%', transform: 'translate(-50%, -50%)', overflow: 'visible', pointerEvents: 'none'}}>
    <path d={`M${CHEVRON_WIDTH} ${width / 2}L${CHEVRON_WIDTH + tip} ${(CHEVRON_HEIGHT + width) / 2}L${CHEVRON_WIDTH} ${CHEVRON_HEIGHT + width / 2}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export function RangeSlider({low, high, min, max, onChange, step = 0, singleEnded = false, disabled = false, perPixel, quiet = false, color, ariaLabel, modulators = [], selectedSource, onSelectSource}: RangeSliderProps) {
  const style = useStyle().getEffectiveStyle();
  const scheme = getColorScheme(resolveColorType(color), style);
  const {line, gap} = modulationLadder(VALUE_THICKNESS);
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
  const topRoom = modulators.length * (gap + line);
  const thumb = (grip: typeof Grip.LOW | typeof Grip.HIGH, value: number, label: string, lowest: number, highest: number) => (
    <div role="slider" tabIndex={disabled ? -1 : 0} aria-label={`${ariaLabel} ${label}`} aria-valuemin={lowest} aria-valuemax={highest} aria-valuenow={value} onKeyDown={nudge(grip)}
      onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
      style={{position: 'absolute', left: `${percent(value)}%`, bottom: HIT_PADDING + VALUE_THICKNESS / 2, width: THUMB_SIZE, height: THUMB_SIZE, transform: 'translate(-50%, 50%)', outline: 'none', display: 'grid', placeItems: 'center'}}>
      {!disabled && <span aria-hidden style={{width: THUMB_DOT, height: THUMB_DOT, borderRadius: '50%', boxSizing: 'border-box', background: quiet ? style.cutoutBackground : scheme.main, border: quiet ? `${Borders.standard.width}px dashed ${scheme.main}` : 'none', boxShadow: quiet || !lit ? 'none' : `0 0 ${BAR_GLOW}px ${scheme.glow}`}}/>}
    </div>
  );
  const lineOf = (modulator: ControlModulator, index: number) => {
    const end = modulator.end ?? RangeEnd.END;
    const base = end === RangeEnd.ORIGIN ? low : high;
    const colorOf = modulatorColor(modulator.root, style);
    const from = percent(base - (modulator.bipolar ? Math.abs(modulator.depth) : Math.max(0, -modulator.depth)));
    const to = percent(base + (modulator.bipolar ? Math.abs(modulator.depth) : Math.max(0, modulator.depth)));
    const y = HIT_PADDING + VALUE_THICKNESS + gap + line / 2 + index * (line + gap);
    const live = modulator.sample === undefined ? undefined : percent(base + modulator.sample * modulator.depth);
    const tipUp = modulator.depth >= 0 || modulator.bipolar;
    const tips = modulator.bipolar ? [{at: from, up: false}, {at: to, up: true}] : [{at: tipUp ? to : from, up: !!tipUp}];
    return (
      <div key={`${modulator.source}${end}`} data-modulator={modulator.source} onPointerDown={event => event.stopPropagation()} onClick={() => onSelectSource?.(modulator.source)}
        style={{position: 'absolute', left: 0, right: 0, bottom: y - LINE_HIT_HEIGHT / 2, height: LINE_HIT_HEIGHT, opacity: modulatorOpacity(modulator.source, selectedSource), transition: 'opacity .17s ease', pointerEvents: 'none'}}>
        <div style={{position: 'absolute', left: `${from}%`, width: `${to - from}%`, top: '50%', height: line, transform: 'translateY(-50%)', borderRadius: line, background: colorOf, boxShadow: `0 0 ${LINE_GLOW}px ${colorOf}`, pointerEvents: 'auto', cursor: 'pointer'}}/>
        {tips.map(tip => <Chevron key={String(tip.up)} at={tip.at} pointsUp={tip.up} color={colorOf} width={line}/>)}
        {live !== undefined && <div style={{position: 'absolute', left: `${live}%`, top: '50%', width: line * LIVE_SCALE, height: line * LIVE_SCALE, transform: 'translate(-50%, -50%)', borderRadius: '50%', background: MODULATOR_LIVE_COLOR, boxShadow: `0 0 ${LINE_GLOW}px ${MODULATOR_LIVE_COLOR}`, pointerEvents: 'none'}}/>}
        <span style={{position: 'absolute', left: `calc(${tips.at(-1)!.at}% + ${tips.at(-1)!.up ? NUMERAL_OFFSET : -NUMERAL_OFFSET}px)`, top: '50%', transform: 'translate(-50%, -50%)', fontSize: NUMERAL_SIZE, fontWeight: 700, lineHeight: 1, color: colorOf, pointerEvents: 'none'}}>{index + 1}</span>
      </div>
    );
  };
  return (
    <div ref={track} data-range-slider style={{position: 'relative', flex: 1, minWidth: 0, height: HIT_PADDING * 2 + VALUE_THICKNESS + topRoom, cursor: disabled ? 'not-allowed' : 'ew-resize', touchAction: 'none', userSelect: 'none'}}
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
      <div data-range-track style={{position: 'absolute', left: 0, right: 0, bottom: HIT_PADDING, height: VALUE_THICKNESS, borderRadius: VALUE_THICKNESS, background: hexToRgba(scheme.main, disabled ? O.ghost : O.faint)}}/>
      <div data-range-bar data-range-quiet={quiet || undefined} style={{position: 'absolute', left: `${percent(singleEnded ? min : low)}%`, width: `${percent(high) - percent(singleEnded ? min : low)}%`, bottom: HIT_PADDING, height: VALUE_THICKNESS, borderRadius: VALUE_THICKNESS, boxSizing: 'border-box',
        background: disabled ? hexToRgba(scheme.main, O.low) : quiet ? 'transparent' : scheme.main, border: quiet && !disabled ? `${Borders.standard.width}px dashed ${scheme.main}` : 'none',
        boxShadow: disabled || quiet ? 'none' : `0 0 ${lit ? BAR_GLOW * 2 : BAR_GLOW}px ${scheme.glow}`, transition: 'box-shadow .17s ease'}}/>
      {!singleEnded && thumb(Grip.LOW, low, 'origin', min, high)}
      {thumb(Grip.HIGH, high, 'end', low, max)}
      {!disabled && modulators.map(lineOf)}
    </div>
  );
}
