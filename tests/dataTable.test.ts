import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { bundled } from './bundled.ts';

interface Element { type: string; props: Record<string, unknown> }
interface TableModule {
  DataTableForm: { readonly FIT: 'fit' };
  DataTable(props: { head?: string[]; rows: (string | number)[][]; form?: 'fit' }): Element;
}
const { module: table, dispose } = await bundled<TableModule>(['src/react/DataTable.tsx']);
after(dispose);

describe('DataTable fit form', () => {
  it('keeps the default table unchanged and marks only the fit form', () => {
    const rows = [['Triangles', 38506]];
    assert.equal(table.DataTable({ rows }).props['data-table-form'], undefined);
    assert.equal(table.DataTable({ rows, form: table.DataTableForm.FIT }).props['data-table-form'], 'fit');
  });
});
