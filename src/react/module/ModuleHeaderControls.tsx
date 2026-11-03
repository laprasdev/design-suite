import React from 'react';
import { D } from '../../synth/design/index.ts';

const G = D.moduleGrid;

/** A module's own header controls in a row, between its tabs and the tile's edge. */
export function ModuleHeaderControls({ children }: { children: React.ReactNode }) {
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: G.headerGap, padding: `0 ${G.headerControlsPadding}px`, flex: 'none',
  };
  return <div data-module-header-controls style={style}>{children}</div>;
}
