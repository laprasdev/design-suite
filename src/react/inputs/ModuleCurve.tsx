import React from 'react';
import { ControlKind } from '../../fields.ts';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O } from '../../synth/design/index.ts';
import { CONTROL_KINDS } from '../grid/controlBoxes.ts';

const G = D.moduleGrid;
const { width: CURVE_W, height: CURVE_H } = CONTROL_KINDS[ControlKind.CURVE];

/** A curve to read. It draws what the asset holds and takes no edits. */
export function ModuleCurve({ points, ariaLabel }: { points: { x: number; y: number }[] | null; ariaLabel: string }) {
  const style = useStyle().getEffectiveStyle();
  const line = points?.map(point => `${point.x * CURVE_W},${(1 - point.y) * CURVE_H}`).join(' ');
  const box: React.CSSProperties = { display: 'block', maxWidth: CURVE_W, overflow: 'visible' };
  return <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${CURVE_W} ${CURVE_H}`} width="100%"
    height={CURVE_H} preserveAspectRatio="none" style={box}>
    <rect x={0} y={0} width={CURVE_W} height={CURVE_H} rx={D.radius.button}
      fill={hexToRgba(style.primaryColor, O.ghost)} />
    {line && <polyline points={line} fill="none" stroke={style.primaryColor} strokeWidth={G.curveLine}
      vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}
