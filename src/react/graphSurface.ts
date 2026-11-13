import type {CSSProperties} from 'react';

/** The Workbench graph's light dot field, shared with other graph surfaces. */
export function graphDots(color = 'var(--text)', zoom = 1): CSSProperties {
  return {backgroundImage: `radial-gradient(color-mix(in srgb,${color} 9%,transparent) ${zoom}px,`
    + `transparent ${1.2 * zoom}px)`, backgroundSize: `${21 * zoom}px ${21 * zoom}px`};
}

/** Shared graph edge treatment. Apply to the background layer to keep nodes and ports crisp. */
export type GraphEdge = 'left' | 'right' | 'top' | 'bottom';
const ALL_EDGES: readonly GraphEdge[] = ['left', 'right', 'top', 'bottom'];
export function graphEdgeFade(inset: number | Partial<Record<GraphEdge, number | string>>,
  edges: readonly GraphEdge[] = ALL_EDGES): CSSProperties {
  const distance = (edge: GraphEdge) => {const value = typeof inset === 'number' ? inset : inset[edge] ?? 0;
    return typeof value === 'number' ? `${value}px` : value;};
  const start = (edge: GraphEdge) => edges.includes(edge) ? `transparent,black ${distance(edge)}` : 'black';
  const end = (edge: GraphEdge) => edges.includes(edge) ? `black calc(100% - ${distance(edge)}),transparent` : 'black';
  const mask = `linear-gradient(to right,${start('left')},${end('right')}),`
    + `linear-gradient(to bottom,${start('top')},${end('bottom')})`;
  return {maskImage: mask, WebkitMaskImage: mask, maskComposite: 'intersect', WebkitMaskComposite: 'source-in'};
}

/** A node keeps its header and ports while its outline fades toward its foot. */
export function nodeFrame(color: string, background: string, width = 1): CSSProperties {
  return {border: `${width}px solid transparent`,
    background: `linear-gradient(${background},${background}) padding-box,`
      + `linear-gradient(to bottom,${color},color-mix(in srgb,${color} 12%,transparent)) border-box`};
}
