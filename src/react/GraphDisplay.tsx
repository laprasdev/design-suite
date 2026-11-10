import React, {forwardRef, useId, type HTMLAttributes} from 'react';
import {useStyle} from '../synth/StyleContext.tsx';
import {designTokens} from '../skins.ts';
import {O, SCALE} from '../synth/design/index.ts';
import {graphEdgeFade, type GraphEdge} from './graphSurface.ts';

/** The classic lifecycle graph's surface, also used by schema-driven plots. */
export const GraphDisplay = forwardRef<HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & {fadeEdges?: readonly GraphEdge[]}>(
  function GraphDisplay({style, fadeEdges, ...props}, ref) {
    const colors = useStyle().getEffectiveStyle();
    return <div {...props} ref={ref} style={{position: 'relative', height: '100%',
      background: colors.cutoutBackground, ...graphEdgeFade(designTokens.graphInset / SCALE, fadeEdges), ...style}}/>;
  });

/** A sampled curve's fill. Calculation remains with its owning model. */
export function GraphFill({path}: {path: string}) {
  const id = `graph-fill-${useId().replace(/:/g, '')}`, {primaryColor} = useStyle().getEffectiveStyle();
  return <>
    <defs><linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor={primaryColor} stopOpacity={O.low}/>
      <stop offset="50%" stopColor={primaryColor} stopOpacity={O.faint}/>
      <stop offset="100%" stopColor={primaryColor} stopOpacity={O.ghost}/>
    </linearGradient></defs>
    <path d={path} fill={`url(#${id})`}/>
  </>;
}
