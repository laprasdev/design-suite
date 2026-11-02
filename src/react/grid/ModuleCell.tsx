import React from 'react';

/** A field's place on a module's grid: whole columns and rows, so nothing sits between two columns. */
export function ModuleCell({ column, row, columns = 1, rows = 1, stretch, children }: {
  column: number; row: number; columns?: number; rows?: number; stretch?: boolean; children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    gridColumn: `${column} / span ${columns}`, gridRow: `${row} / span ${rows}`, minWidth: 0,
    ...(stretch && { justifySelf: 'stretch', alignSelf: 'stretch' }),
  };
  return <div data-grid-cell={`${column},${row}`} style={style}>{children}</div>;
}
