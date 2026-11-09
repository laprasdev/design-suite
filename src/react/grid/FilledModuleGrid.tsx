import React from 'react';
import { D } from '../../synth/design/index.ts';
import { FieldAlign, ModuleControlSize, ModuleFieldAlign } from './gridContext.ts';
import { useFilledControlSize } from './useFilledControlSize.ts';

const G = D.moduleGrid;

const GROWING_ROW = 'minmax(min-content, 1fr)';

function filledStyle(rows: number, columns: number, fill: boolean, growRows: readonly number[]): React.CSSProperties {
  const column = fill ? '1fr' : `${G.fillColumnMax}px`;
  const track = (grows: boolean) => grows ? GROWING_ROW : 'max-content';
  // Rows that all take the same track keep one repeat(). A grid with rows that grow names each track: those rows take
  // the spare room, and the rest keep their content's height, whether or not the rest would share it.
  const templateRows = growRows.length
    ? Array.from({ length: rows }, (_, index) => track(growRows.includes(index + 1))).join(' ')
    : `repeat(${rows}, ${track(fill)})`;
  return {
    flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', boxSizing: 'border-box', display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, ${column}))`, gridTemplateRows: templateRows,
    alignContent: fill ? undefined : 'start', justifyContent: fill ? undefined : 'start', gap: G.fillGap,
    padding: G.fillPadding, lineHeight: G.tightLine,
  };
}

/**
 * A page's grid: the same four columns, each growing with its tile up to `fillColumnMax`. Rows take what their fields
 * need and gather at the top, so what a tile has to spare collects below the module as one block. `fill` instead
 * stretches the rows over the tile, for a body that is a drawing. `sizingRows` is the most rows any of the module's
 * tabs has, so controls keep their size across tabs. `growRows` are the rows, counted from 1, that take what the
 * tile has to spare while the others keep their content's height, for a field that fills its row, like a grid of
 * icons; with `fill` too they take it instead of the equal shares. `columns` is fewer than four where a body's few
 * cells share its width, like a row of knobs. Too small a tile scrolls this body under its header.
 */
export function FilledModuleGrid({ rows, sizingRows = rows, columns = G.columns, fill = false, growRows = [],
  children }: {
  rows: number; sizingRows?: number; columns?: number; fill?: boolean; growRows?: readonly number[];
  children: React.ReactNode;
}) {
  const { grid, size } = useFilledControlSize(sizingRows, columns);
  const align = fill ? FieldAlign.CENTER : FieldAlign.START;
  return (
    <div ref={grid} data-module-grid data-grid-rows={rows} data-grid-fill={fill || undefined} data-control-size={size}
      style={filledStyle(rows, columns, fill, growRows)}>
      <ModuleFieldAlign.Provider value={align}>
        <ModuleControlSize.Provider value={size}>{children}</ModuleControlSize.Provider>
      </ModuleFieldAlign.Provider>
    </div>
  );
}
