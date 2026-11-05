import React from 'react';
import {designTokens} from '../skins.ts';

const G = designTokens.controllerGeometry, C = designTokens.controllerControls;
type Paint = React.SVGAttributes<SVGElement>;

/** Capsule shoulders from the module proposal; positions and sizes stay with the shared controller geometry. */
export function ControllerShoulder({cx, cy, kind, ...paint}: Paint & {
  cx: number; cy: number; kind: 'trigger' | 'bumper';
}) {
  const width = kind === 'trigger' ? G.triggerWidth : G.shoulderWidth;
  const height = kind === 'trigger' ? G.triggerHeight : G.bumperHeight;
  return <rect data-controller-shoulder={kind} x={cx - width / 2} y={cy - height / 2}
    width={width} height={height} rx={height / 2} vectorEffect="non-scaling-stroke" {...paint}/>;
}

/** The proposal's two rounded cross bars, centered on the same live D-pad directions. */
export function ControllerDpad({stroke, opacity = 1}: {stroke: string; opacity?: number}) {
  const x = C.Up[0], y = C.Left[1], width = G.dpadSize, height = G.dpadStep * 2 + G.dpadHeight;
  const paint = {fill: 'none', stroke, opacity, strokeWidth: G.strokeWidth, rx: width / 3,
    vectorEffect: 'non-scaling-stroke' as const};
  return <g data-dpad-outline>
    <rect x={x - width / 2} y={y - height / 2} width={width} height={height} {...paint}/>
    <rect x={x - height / 2} y={y - width / 2} width={height} height={width} {...paint}/>
  </g>;
}
