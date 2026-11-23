import React from 'react';
import { D } from '../../synth/design/index.ts';
import { FieldAlign, ModuleControlSize, ModuleFieldAlign, ModuleFieldBeside } from './gridContext.ts';
import { useFilledControlSize } from './useFilledControlSize.ts';
import { LINE_TRACK } from './lineTrack.ts';

const G = D.moduleGrid;

const GROWING_ROW = 'minmax(min-content, 1fr)';

function filledStyle(rows: number, columns: number, growRows: readonly number[]): React.CSSProperties {
  const templateRows = Array.from({ length: rows },
    (_, index) => growRows.includes(index + 1) ? GROWING_ROW : LINE_TRACK);
  return {
    flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', boxSizing: 'border-box', display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, ${G.fillColumnMax}px))`,
    gridTemplateRows: templateRows.join(' '),
    alignContent: 'start', justifyContent: 'start', gap: G.fillGap, padding: G.fillPadding, lineHeight: G.tightLine,
  };
}

/**
 * A page's grid: the same four columns, each growing with its tile up to `fillColumnMax`. Rows take what their fields
 * need and gather at the top, so a tile sized to its content holds no empty band. `growRows` are the rows, counted
 * from 1, that take what the tile has to spare: a drawing's, or a field that fills its row, like a grid of icons.
 * `columns` is fewer than four where a body's few cells share its width, like a row of knobs. Too small a tile scrolls
 * this body under its header.
 */
export function FilledModuleGrid({ rows, columns = G.columns, growRows = [], children }: {
  rows: number; columns?: number; growRows?: readonly number[]; children: React.ReactNode;
}) {
  const { grid, size, beside } = useFilledControlSize(columns, rows);
  return (
    <div ref={grid} data-module-grid data-grid-rows={rows} data-control-size={size}
      data-field-beside={beside || undefined}
      style={filledStyle(rows, columns, growRows)}>
      <ModuleFieldAlign.Provider value={FieldAlign.START}>
        <ModuleControlSize.Provider value={size}>
          <ModuleFieldBeside.Provider value={beside}>{children}</ModuleFieldBeside.Provider>
        </ModuleControlSize.Provider>
      </ModuleFieldAlign.Provider>
    </div>
  );
}
