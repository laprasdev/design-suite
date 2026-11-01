import React, {useRef, useState} from 'react';
import {useStyle} from '../../StyleContext.tsx';
import {LayoutDimensions} from '../../../layout.ts';
import {getColorScheme, hexToRgba, resolveColorType, type AnyColor} from '../../../color.ts';
import {O} from '../../design/index.ts';
import {MODULATOR_LIVE_COLOR, RangeEnd, VALUE_THICKNESS, modulationLadder, modulatorColor, modulatorOpacity, type ControlModulator, type ModulationProps} from './modulation.ts';

// A range as one rounded bar. Each modulator is a thinner line above the end it moves, pointing where the value goes.
const HIT_PADDING = 6;
const NEAR_END_PX = 10;
const THUMB_SIZE = 14;
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
  color?: AnyColor;
  ariaLabel: string;
}

function Chevron({at, pointsUp, color, width}: {at: number; pointsUp: boolean; color: string; width: number}) {
  const tip = pointsUp ? CHEVRON_WIDTH : -CHEVRON_WIDTH;
  return <svg width={CHEVRON_WIDTH * 2} height={CHEVRON_HEIGHT + width} style={{position: 'absolute', left: `${at}%`, top: '50%', transform: 'translate(-50%, -50%)', overflow: 'visible', pointerEvents: 'none'}}>
    <path d={`M${CHEVRON_WIDTH} ${width / 2}L${CHEVRON_WIDTH + tip} ${(CHEVRON_HEIGHT + width) / 2}L${CHEVRON_WIDTH} ${CHEVRON_HEIGHT + width / 2}`} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

export function RangeSlider({low, high, min, max, onChange, step = 0, singleEnded = false, disabled = false, color, ariaLabel, modulators = [], selectedSource, onSelectSource}: RangeSliderProps) {
  const style = useStyle().getEffectiveStyle();
  const scheme = getColorScheme(resolveColorType(color), style);
  const {line, gap} = modulationLadder(VALUE_THICKNESS);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{grip: GripValue; low: number; high: number; start: number} | null>(null);
  const [active, setActive] = useState(false);
  const [hovered, setHovered] = useState(false);
  const span = max - min;
  const percent = (value: number) => (Math.min(max, Math.max(min, value)) - min) / span * 100;
  // Through the step's own decimals, so a tenth is written as a tenth and not 16.000000000000004.
  const stepDecimals = (String(step).split('.')[1] ?? '').length;
  const snap = (value: number) => (step > 0 ? Number((Math.round(value / step) * step).toFixed(stepDecimals)) : value);
  const valueAt = (clientX: number) => {
    const box = track.current!.getBoundingClientRect();
    return min + Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * span;
  };
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
    const value = valueAt(clientX);
    if (held.grip === Grip.LOW) onChange?.(Math.min(snap(value), high), high);
    else if (held.grip === Grip.HIGH) onChange?.(low, Math.max(snap(value), low));
    else {
      const shift = Math.min(max - held.high, Math.max(min - held.low, snap(value - held.start)));
      onChange?.(held.low + shift, held.high + shift);
    }
  };
  const nudge = (grip: typeof Grip.LOW | typeof Grip.HIGH) => (event: React.KeyboardEvent) => {
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!direction || disabled) return;
    event.preventDefault();
    const amount = direction * (step || span / 100);
    if (grip === Grip.LOW) onChange?.(Math.min(high, Math.max(min, low + amount)), high);
    else onChange?.(low, Math.max(low, Math.min(max, high + amount)));
  };
  const lit = (active || hovered) && !disabled;
  const topRoom = modulators.length * (gap + line);
  const thumb = (grip: typeof Grip.LOW | typeof Grip.HIGH, value: number, label: string, lowest: number, highest: number) => (
    <div role="slider" tabIndex={disabled ? -1 : 0} aria-label={`${ariaLabel} ${label}`} aria-valuemin={lowest} aria-valuemax={highest} aria-valuenow={value} onKeyDown={nudge(grip)}
      onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}
      style={{position: 'absolute', left: `${percent(value)}%`, bottom: HIT_PADDING + VALUE_THICKNESS / 2, width: THUMB_SIZE, height: THUMB_SIZE, transform: 'translate(-50%, 50%)', outline: 'none'}}/>
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
        event.currentTarget.setPointerCapture(event.pointerId);
        const grip = gripAt(event.clientX);
        drag.current = {grip, low, high, start: valueAt(event.clientX)};
        setActive(true);
        if (grip !== Grip.BOTH) applyDrag(event.clientX);
      }}
      onPointerMove={event => applyDrag(event.clientX)}
      onPointerUp={() => { drag.current = null; setActive(false); }}
      onPointerCancel={() => { drag.current = null; setActive(false); }}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: HIT_PADDING, height: VALUE_THICKNESS, borderRadius: VALUE_THICKNESS, background: hexToRgba(style.knobGradient.at(-1)!, O.high)}}/>
      <div style={{position: 'absolute', left: `${percent(singleEnded ? min : low)}%`, width: `${percent(high) - percent(singleEnded ? min : low)}%`, bottom: HIT_PADDING, height: VALUE_THICKNESS, borderRadius: VALUE_THICKNESS,
        background: disabled ? hexToRgba(scheme.main, O.low) : scheme.main, boxShadow: disabled ? 'none' : `0 0 ${lit ? BAR_GLOW * 2 : BAR_GLOW}px ${scheme.glow}`, transition: 'box-shadow .17s ease'}}/>
      {!singleEnded && thumb(Grip.LOW, low, 'origin', min, high)}
      {thumb(Grip.HIGH, high, 'end', low, max)}
      {!disabled && modulators.map(lineOf)}
    </div>
  );
}
