import React from 'react';
import {useStyle} from '../../StyleContext.tsx';
import {LayoutDimensions} from '../../../layout.ts';
import {ModulationPart} from '../../../react/inputs/modulationParts.ts';
import {MODULATOR_GLOW, MODULATOR_LIVE_COLOR, RangeEnd, modulationLadder, modulatorColor, modulatorOpacity, MODULATOR_FADE, type ModulationProps} from './modulation.ts';

const SWEEP_DEGREES = 270;
const SWEEP_START = -135;
const SWEEP_END = SWEEP_START + SWEEP_DEGREES;
const BIPOLAR_GAP_DEGREES = 0.7;
const NUMERAL_OFFSET = 7;
const NUMERAL_SIZE = LayoutDimensions.moduleGrid.ringNumeralSize;
const LIVE_RADIUS_FACTOR = 0.8;
const HIT_WIDTH = 7;
const degrees = (radians: number) => radians * 180 / Math.PI;

function point(center: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return [center + radius * Math.sin(radians), center - radius * Math.cos(radians)];
}
function arc(center: number, radius: number, from: number, to: number) {
  const [x0, y0] = point(center, radius, from), [x1, y1] = point(center, radius, to);
  return `M${x0} ${y0}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}
const clampAngle = (angle: number) => Math.min(SWEEP_END, Math.max(SWEEP_START, angle));

export interface ModulationRingsProps extends ModulationProps {
  size: number;
  radius: number;
  thickness: number;
  /** The base value, 0 to 1 along the knob's sweep. */
  fraction: number;
  originFraction?: number;
  span: number;
}

// Rings grow from where the value's arc ends, each on its own radius, one numeral per source at its far end.
export function ModulationRings({modulators = [], selectedSource, onSelectSource, size, radius, thickness, fraction, originFraction, span}: ModulationRingsProps) {
  const style = useStyle().getEffectiveStyle();
  const center = size / 2, {line, gap} = modulationLadder(thickness);
  const outer = radius + thickness / 2 + modulators.length * (gap + line);
  return (
    <svg width={size} height={size} style={{position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none'}}>
      {modulators.map((modulator, index) => {
        const value = modulator.end === RangeEnd.ORIGIN ? originFraction ?? fraction : fraction;
        const valueEdge = SWEEP_START + SWEEP_DEGREES * value + degrees(thickness / 2 / radius);
        const ringRadius = radius + thickness / 2 + gap + line / 2 + index * (line + gap);
        const cap = degrees(line / 2 / ringRadius);
        const reach = Math.abs(modulator.depth) / span * SWEEP_DEGREES;
        const upward = modulator.depth >= 0;
        const segments = modulator.bipolar
          ? [[valueEdge - cap - BIPOLAR_GAP_DEGREES - reach, valueEdge - cap - BIPOLAR_GAP_DEGREES], [valueEdge + cap + BIPOLAR_GAP_DEGREES, valueEdge + cap + BIPOLAR_GAP_DEGREES + reach]]
          : upward ? [[valueEdge + cap, valueEdge + cap + reach]] : [[valueEdge - cap - reach, valueEdge - cap]];
        const drawn = segments.map(([from, to]) => [clampAngle(from), clampAngle(to)]).filter(([from, to]) => to > from);
        const farAngle = upward || modulator.bipolar ? drawn.at(-1)?.[1] : drawn[0]?.[0];
        const color = modulatorColor(modulator.root, style);
        const select = (event: React.MouseEvent) => { event.stopPropagation(); onSelectSource?.(modulator.source); };
        const [numeralX, numeralY] = point(center, outer + NUMERAL_OFFSET, farAngle ?? valueEdge);
        const live = modulator.sample === undefined ? undefined : point(center, ringRadius, clampAngle(valueEdge + modulator.sample * modulator.depth / span * SWEEP_DEGREES));
        return (
          <g key={`${modulator.source}${index}`} {...{[ModulationPart.SOURCE]: modulator.source}} opacity={modulatorOpacity(modulator.source, selectedSource)} style={{transition: MODULATOR_FADE}}>
            {drawn.map(([from, to], part) => <path key={part} d={arc(center, ringRadius, from, to)} fill="none" stroke={color} strokeWidth={line} strokeLinecap="round" style={{filter: `drop-shadow(0 0 ${MODULATOR_GLOW}px ${color})`}}/>)}
            {drawn.map(([from, to], part) => <path key={part} d={arc(center, ringRadius, from, to)} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} strokeLinecap="round"
              style={{pointerEvents: 'stroke', cursor: 'pointer'}} onMouseDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onClick={select}/>)}
            {live && <circle cx={live[0]} cy={live[1]} r={line * LIVE_RADIUS_FACTOR} fill={MODULATOR_LIVE_COLOR} style={{filter: `drop-shadow(0 0 ${MODULATOR_GLOW}px ${MODULATOR_LIVE_COLOR})`}}/>}
            <text x={numeralX} y={numeralY} fill={color} fontSize={NUMERAL_SIZE} fontWeight={700} textAnchor="middle" dominantBaseline="middle">{index + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}
