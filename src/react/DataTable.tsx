// =====================================================
// DataTable — a small read-only table of named counts and notes: the census
// a record carries, laid out in aligned columns. Domain-free; the consumer
// supplies the column heads and the rows, and styles no cell itself.
// =====================================================
import React, { type TableHTMLAttributes } from "react";

export interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  head?: readonly string[];
  rows: readonly (readonly (string | number)[])[];
}

export function DataTable({ head, rows, className = "", ...rest }: DataTableProps) {
  return (
    <table className={`bd-table${className ? " " + className : ""}`} {...rest}>
      {head && (
        <thead>
          <tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
