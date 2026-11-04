import React from 'react';
import { D } from '../../synth/design/index.ts';
import { FieldAlign, ModuleControlSize, ModuleFieldAlign } from './gridContext.ts';
import { useFilledControlSize } from './useFilledControlSize.ts';

const G = D.moduleGrid;

function filledStyle(rows: number, fill: boolean): React.CSSProperties {
  const column = fill ? '1fr' : `${G.fillColumnMax}px`, row = fill ? 'minmax(min-content, 1fr)' : 'max-content';
  return {
    flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', boxSizing: 'border-box', display: 'grid',
    gridTemplateColumns: `repeat(${G.columns}, minmax(0, ${column}))`, gridTemplateRows: `repeat(${rows}, ${row})`,
    alignContent: fill ? undefined : 'start', justifyContent: fill ? undefined : 'start', gap: G.fillGap,
    padding: G.fillPadding, lineHeight: G.tightLine,
  };
}

/**
 * A page's grid: the same four columns, each growing with its tile up to `fillColumnMax`. Rows take what their fields
 * need and gather at the top, so what a tile has to spare collects below the module as one block. `fill` instead
 * stretches the rows over the tile, for a body that is a drawing. `sizingRows` is the most rows any of the module's
 * tabs has, so controls keep their size across tabs. Too small a tile scrolls this body under its header.
 */
export function FilledModuleGrid({ rows, sizingRows = rows, fill = false, children }: {
  rows: number; sizingRows?: number; fill?: boolean; children: React.ReactNode;
}) {
  const { grid, size } = useFilledControlSize(sizingRows);
  const align = fill ? FieldAlign.CENTER : FieldAlign.START;
  return (
    <div ref={grid} data-module-grid data-grid-rows={rows} data-grid-fill={fill || undefined} data-control-size={size}
      style={filledStyle(rows, fill)}>
      <ModuleFieldAlign.Provider value={align}>
        <ModuleControlSize.Provider value={size}>{children}</ModuleControlSize.Provider>
      </ModuleFieldAlign.Provider>
    </div>
  );
}
