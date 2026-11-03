import React from 'react';
import { D } from '../../synth/design/index.ts';

// A module's body is four equal columns, and every control takes whole cells, so nothing sits between two columns or
// moves between tabs. In the rack it has a fixed size; on a page FilledModuleGrid fills its tile.
const G = D.moduleGrid;

const rackStyle = (rowsPerKnob: number): React.CSSProperties => ({
  display: 'grid', gridTemplateColumns: `repeat(${G.columns}, ${G.cellWidth}px)`,
  gridTemplateRows: `repeat(${G.rows * rowsPerKnob}, ${G.rowHeight / rowsPerKnob}px)`,
  padding: `${G.ringHeadroom}px ${G.sidePadding}px ${G.footPadding}px`, alignItems: 'start', justifyItems: 'center',
  lineHeight: G.tightLine,
});

/** The rack's fixed grid. */
export function ModuleGrid({ rowsPerKnob = 1, children }: { rowsPerKnob?: 1 | 2; children: React.ReactNode }) {
  return <div data-module-grid style={rackStyle(rowsPerKnob)}>{children}</div>;
}
