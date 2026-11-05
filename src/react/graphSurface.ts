import type {CSSProperties} from 'react';

/** The Workbench graph's light dot field, shared with other graph surfaces. */
export function graphDots(color = 'var(--text)', zoom = 1): CSSProperties {
  return {backgroundImage: `radial-gradient(color-mix(in srgb,${color} 9%,transparent) ${zoom}px,`
    + `transparent ${1.2 * zoom}px)`, backgroundSize: `${21 * zoom}px ${21 * zoom}px`};
}

/** Shared graph edge treatment. Apply to the background layer to keep nodes and ports crisp. */
export function graphEdgeFade(inset: number): CSSProperties {
  const mask = `linear-gradient(to right,transparent,black ${inset}px,`
    + `black calc(100% - ${inset}px),transparent),`
    + `linear-gradient(to bottom,transparent,black ${inset}px,`
    + `black calc(100% - ${inset}px),transparent)`;
  return {maskImage: mask, WebkitMaskImage: mask, maskComposite: 'intersect', WebkitMaskComposite: 'source-in'};
}

/** A node keeps its header and ports while its outline fades toward its foot. */
export function nodeFrame(color: string, background: string, width = 1): CSSProperties {
  return {border: `${width}px solid transparent`,
    background: `linear-gradient(${background},${background}) padding-box,`
      + `linear-gradient(to bottom,${color},color-mix(in srgb,${color} 12%,transparent)) border-box`};
}
