// =====================================================
// DataTable — a small read-only table of named counts and notes: the census
// a record carries, laid out in aligned columns. Domain-free; the consumer
// supplies the column heads and the rows, and styles no cell itself.
// =====================================================
import React, { type ReactNode, type TableHTMLAttributes } from "react";

// FIT sizes the table to its content instead of the full width.
export const DataTableForm = Object.freeze({ FIT: 'fit' } as const);
export type DataTableForm = (typeof DataTableForm)[keyof typeof DataTableForm];

export interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  head?: readonly ReactNode[];
  rows: readonly (readonly ReactNode[])[];
  form?: DataTableForm;
  columnAlign?: readonly ('left'|'right'|'center'|null)[];
}

export function DataTable({ head, rows, className = "", form, columnAlign, ...rest }: DataTableProps) {
  return (
    <table className={`bd-table${className ? " " + className : ""}`} data-table-form={form} {...rest}>
      {head && (
        <thead>
          <tr>{head.map((h, i) => <th key={i} scope="col" style={{textAlign:columnAlign?.[i]
            ?? undefined}}>{h}</th>)}</tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} style={{textAlign:columnAlign?.[j] ?? undefined}}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
