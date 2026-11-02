import React from 'react';
import { useStyle } from '../../synth/StyleContext.tsx';
import { hexToRgba } from '../../color.ts';
import { D, O } from '../../synth/design/index.ts';

const G = D.moduleGrid;

/** A curve to read. It draws what the asset holds and takes no edits. */
export function ModuleCurve({ points, ariaLabel }: { points: { x: number; y: number }[] | null; ariaLabel: string }) {
  const style = useStyle().getEffectiveStyle();
  const line = points?.map(point => `${point.x * G.curveWidth},${(1 - point.y) * G.curveHeight}`).join(' ');
  const box: React.CSSProperties = { display: 'block', maxWidth: G.curveWidth, overflow: 'visible' };
  return <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${G.curveWidth} ${G.curveHeight}`} width="100%"
    height={G.curveHeight} preserveAspectRatio="none" style={box}>
    <rect x={0} y={0} width={G.curveWidth} height={G.curveHeight} rx={D.radius.button}
      fill={hexToRgba(style.primaryColor, O.ghost)} />
    {line && <polyline points={line} fill="none" stroke={style.primaryColor} strokeWidth={G.curveLine}
      vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}
