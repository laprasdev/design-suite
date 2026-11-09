import React from 'react';
import {designTokens} from '../skins.ts';
import {PHI} from '../layout.ts';
import {Typography} from '../tokens.ts';

const G = designTokens.controllerGeometry, C = designTokens.controllerControls;
type Paint = React.SVGAttributes<SVGElement>;
export const controllerStroke = G.strokeWidth * 2.5;
export const controllerFaceRadius = G.faceRadius - G.buttonInset;
export const controllerFaceHitRadius = Math.min(G.hitRadius, G.faceStep / PHI / Math.SQRT2);
const SHOULDER_BAND = G.bumperHeight, SHOULDER_GAP = G.phaseInset * 2;
const HALF_CHORD = (G.shoulderWidth - SHOULDER_BAND - G.phaseInset * 2) / 2, ARCH_RISE = G.bumperHeight;
const SHOULDER_RADIUS = (HALF_CHORD ** 2 + ARCH_RISE ** 2) / (2 * ARCH_RISE);
const SHOULDER_ANGLE = Math.asin(HALF_CHORD / SHOULDER_RADIUS);
const TRIGGER_BAND = SHOULDER_BAND * PHI;
const TRIGGER_RADIUS = SHOULDER_RADIUS + (SHOULDER_BAND + TRIGGER_BAND) / 2 + SHOULDER_GAP;
export const controllerShoulderSize = {
  width: 2 * TRIGGER_RADIUS * Math.sin(SHOULDER_ANGLE) + TRIGGER_BAND,
  height: TRIGGER_RADIUS * (1 - Math.cos(SHOULDER_ANGLE)) + TRIGGER_BAND,
};

/** Both bands share a circle centre, so the trigger nests around the bumper with one constant gap. */
export function controllerShoulderY(kind: 'trigger' | 'bumper') {
  return G.bumperY - (kind === 'trigger' ? SHOULDER_BAND + SHOULDER_GAP : 0);
}

export function ControllerShoulder({cx, cy, kind, ...paint}: Paint & {
  cx: number; cy: number; kind: 'trigger' | 'bumper';
}) {
  const radius = kind === 'trigger' ? TRIGGER_RADIUS : SHOULDER_RADIUS;
  const cap = (kind === 'trigger' ? TRIGGER_BAND : SHOULDER_BAND) / 2;
  const outer = radius + cap, inner = radius - cap, originY = radius - cap;
  const ox = outer * Math.sin(SHOULDER_ANGLE), oy = originY - outer * Math.cos(SHOULDER_ANGLE);
  const ix = inner * Math.sin(SHOULDER_ANGLE), iy = originY - inner * Math.cos(SHOULDER_ANGLE);
  const path = `M ${-ox},${oy} A ${outer},${outer} 0 0 1 ${ox},${oy}
    A ${cap},${cap} 0 0 1 ${ix},${iy} A ${inner},${inner} 0 0 0 ${-ix},${iy}
    A ${cap},${cap} 0 0 1 ${-ox},${oy} Z`;
  return <path data-controller-shoulder={kind} d={path} transform={`translate(${cx} ${cy})`}
    vectorEffect="non-scaling-stroke" strokeLinejoin="round" {...paint}/>;
}

export function ControllerMeta({cx, cy, ...paint}: Paint & {cx: number; cy: number}) {
  return <rect data-controller-meta x={cx - G.metaRadius * 1.25} y={cy - G.metaRadius / 2}
    width={G.metaRadius * 2.5} height={G.metaRadius} rx={G.strokeWidth}
    vectorEffect="non-scaling-stroke" {...paint}/>;
}

const FACE_ARROWS: Record<string, number> = {NorthButton: 0, EastButton: 90, SouthButton: 180, WestButton: 270};
const ARROWS: Record<string, number> = {...FACE_ARROWS, Up: 0, Right: 90, Down: 180, Left: 270};

/** The drawn control, its glyph and its hit target use one position. Bindings stay consumer-owned. */
export function controllerControlPosition(control: string): readonly [number, number] {
  const [x, y] = C[control as keyof typeof C];
  if (/Trigger|Bumper/.test(control))
    return [x, controllerShoulderY(control.endsWith('Trigger') ? 'trigger' : 'bumper')];
  if (control in FACE_ARROWS) {
    const cx = C.NorthButton[0], cy = C.WestButton[1];
    return [cx + (x - cx) / PHI, cy + (y - cy) / PHI];
  }
  return [x, y];
}
const NAMES: Record<string, string> = {LeftTrigger: 'LT', RightTrigger: 'RT', LeftBumper: 'LB',
  RightBumper: 'RB', MoveJoystickPress: 'LS', CameraJoystickPress: 'RS'};

/** Glyphs describe physical controls; gesture bindings remain with the application. */
export function ControllerGlyph({control, color}: {control: string; color: string}) {
  const [x, y] = controllerControlPosition(control), shoulder = /Trigger|Bumper/.test(control);
  const band = control.endsWith('Trigger') ? TRIGGER_BAND : SHOULDER_BAND;
  if (control in ARROWS) {
    const r = G.metaRadius / 2;
    return <path data-controller-glyph={control} d={`M ${-r},${r / 2} L 0,${-r} L ${r},${r / 2} Z`}
      transform={`translate(${x} ${y}) rotate(${ARROWS[control]})`} fill={color} pointerEvents="none"/>;
  }
  if (!NAMES[control]) return null;
  return <text className="bd-label" data-controller-glyph={control} x={x} y={shoulder ? y - band / 2 : y}
    dominantBaseline="central" textAnchor="middle"
    fill={color} fontWeight={Typography.title.fontWeight}
    fontSize={shoulder ? G.bumperHeight : G.faceRadius}
    pointerEvents="none">{NAMES[control]}</text>;
}

/** A single perimeter avoids the overlapping seams of the former two rectangles. */
export function ControllerDpad({stroke, opacity = 1}: {stroke: string; opacity?: number}) {
  const x = C.Up[0], y = C.Left[1], a = G.dpadSize / 2, b = G.dpadStep + G.dpadHeight / 2;
  return <g data-dpad-outline opacity={opacity}>
    <path d={`M ${x-a},${y-b} H ${x+a} V ${y-a} H ${x+b} V ${y+a} H ${x+a}
      V ${y+b} H ${x-a} V ${y+a} H ${x-b} V ${y-a} H ${x-a} Z`}
      fill="none" stroke={stroke} strokeWidth={controllerStroke} strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"/>
    {['Up', 'Right', 'Down', 'Left'].map(control => <ControllerGlyph key={control} control={control}
      color={stroke}/>)}</g>;
}
