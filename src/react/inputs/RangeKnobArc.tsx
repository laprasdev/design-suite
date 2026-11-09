import React from 'react';
import {RangeLimitLabels} from '../../synth/components/synth/lifecycle/RangeLimitLabels.tsx';
import {TransitionKeys} from '../../synth/design/index.ts';
interface Props {
  size: number; stroke: number; low: number; high: number; inactive: string; color: string;
  opacity: number; glow?: string; min: number; max: number; text: string; showLimits: boolean;
}
export function RangeKnobArc({size, stroke, low, high, inactive, color, opacity, glow,
  min, max, text, showLimits}: Props) {
  const radius = (size - stroke) / 2 - 2, center = size / 2;
  const at = (fraction: number) => {
    const radians = (135 + 270 * fraction) * Math.PI / 180;
    return {x: center + radius * Math.cos(radians), y: center + radius * Math.sin(radians)};
  };
  const from = at(0), to = at(1), start = at(low), end = at(high);
  return <svg width={size} height={size} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
    <path d={`M${from.x} ${from.y}A${radius} ${radius} 0 1 1 ${to.x} ${to.y}`}
      fill="none" stroke={inactive} strokeWidth={stroke} strokeLinecap="round"/>
    {high > low && <path
      d={`M${start.x} ${start.y}A${radius} ${radius} 0 ${(high - low) * 270 > 180 ? 1 : 0} 1 ${end.x} ${end.y}`}
      fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" opacity={opacity}
      style={{filter: glow, transition: TransitionKeys.normal}}/>}
    {showLimits && <RangeLimitLabels min={min} max={max} color={text}
      minAt={{x: from.x - 3, y: from.y + 2}} maxAt={{x: to.x + 3, y: to.y + 2}}/>}
  </svg>;
}
