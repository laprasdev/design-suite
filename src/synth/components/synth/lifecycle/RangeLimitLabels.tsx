import React from 'react';

const LABEL_SIZE = 6;
const LABEL_OPACITY = 0.3;
interface At { x: number; y: number }

/** A range knob's own ends at the ends of its ring, in pico type at 30% opacity. */
interface Props { min: number; max: number; minAt: At; maxAt: At; color: string }

export function RangeLimitLabels({ min, max, minAt, maxAt, color }: Props) {
  const shared = { fontSize: LABEL_SIZE, fill: color, fillOpacity: LABEL_OPACITY, fontWeight: 'normal' } as const;
  return <>
    <text x={minAt.x} y={minAt.y} textAnchor="end" {...shared}>{min}</text>
    <text x={maxAt.x} y={maxAt.y} textAnchor="start" {...shared}>{max}</text>
  </>;
}
