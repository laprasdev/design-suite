import {useStyle} from '../synth/StyleContext.tsx';
import {hexToRgba} from '../color.ts';
import React, {useId} from 'react';
import {PHI} from '../layout.ts';
import {O} from '../synth/design/index.ts';
import {KnobForm, type KnobFormValue} from '../synth/design/constants/KnobConfig.ts';

const START = 225, SWEEP = 270, THIN = 1;
interface FaceProps {
  percentage: number; size: number; innerSize: number; color: string;
  form: KnobFormValue;
}

/** Flat faces share the knob's drag/value model. A cutout removes alpha, including at the rim. */
export function KnobFace({percentage, size, innerSize, color, form}: FaceProps) {
  const id = useId(), center = size / 2, radius = innerSize / 2;
  const angle = START + SWEEP * percentage;
  const cutout = form === KnobForm.CUTOUT;
  const from = center - radius / (PHI * PHI), to = center - radius - THIN;
  return <svg data-knob-face data-knob-form={form} width={size} height={size}
    style={{position: 'absolute', inset: 0, pointerEvents: 'none'}} aria-hidden>
    {cutout && <defs><mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={size} height={size}
      style={{maskType: 'luminance'}}>
      <rect width={size} height={size} fill="white" />
      <line x1={center} y1={from} x2={center} y2={to} stroke="black" strokeWidth={THIN * 2}
        transform={`rotate(${angle} ${center} ${center})`} />
    </mask></defs>}
    <circle cx={center} cy={center} r={radius} fill={cutout ? color : 'none'} stroke={color}
      strokeWidth={THIN} mask={cutout ? `url(#${id})` : undefined} />
    {!cutout && <line x1={center} y1={from} x2={center} y2={center - radius / PHI}
      stroke={color} strokeWidth={THIN} transform={`rotate(${angle} ${center} ${center})`} />}
  </svg>;
}

/** Existing additive line retained as a distinct comparison form. */
export function KnobLineIndicator({percentage, size, innerSize, color, dimmed}: {
  percentage: number; size: number; innerSize: number; color: string; dimmed: boolean;
}) {
  const center = size / 2, radius = innerSize / 2, angle = (START + SWEEP * percentage) * Math.PI / 180;
  const at = (fraction: number) => [center + radius * fraction * Math.sin(angle),
    center - radius * fraction * Math.cos(angle)];
  const [x1, y1] = at(0.44), [x2, y2] = at(0.83);
  return <svg width={size} height={size} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" strokeLinecap="round"
      opacity={dimmed ? O.low : 1} />
  </svg>;
}

const RING_INSET = 2;
// =====================================================
// HORSESHOE RING - SVG arc for knob fill
// =====================================================
interface HorseshoeRingProps {
  percentage: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  startAngle?: number;
  endAngle?: number;
}

export function HorseshoeRing({
  percentage,
  color = '#4dd4e8',
  size = 60,
  strokeWidth = 3,
  startAngle = 225,
  endAngle = 495
}: HorseshoeRingProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();

  const center = size / 2;
  const radius = (size - strokeWidth) / 2 - RING_INSET;
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (endAngle - 90) * (Math.PI / 180);
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (totalAngle * percentage);
  const currentRad = (currentAngle - 90) * (Math.PI / 180);

  const x1 = center + radius * Math.cos(startRad);
  const y1 = center + radius * Math.sin(startRad);
  const x2 = center + radius * Math.cos(currentRad);
  const y2 = center + radius * Math.sin(currentRad);
  const largeArc = (currentAngle - startAngle) > 180 ? 1 : 0;
  const inactiveStroke = hexToRgba(style.knobGradient.at(-1)!, O.high);

  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <path
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 1 1 `+
          `${center + radius * Math.cos(endRad)} ${center + radius * Math.sin(endRad)}`}
        fill="none"
        stroke={inactiveStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {percentage > 0 && (
        <path
          d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
