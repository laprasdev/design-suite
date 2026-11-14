import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { bundled } from './bundled.ts';

interface Element { type: string; props: Record<string, unknown> }
interface TableModule {
  DataTableForm: { readonly FIT: 'fit'; readonly WRAP: 'wrap' };
  DataTable(props: { head?: string[]; rows: (string | number)[][]; form?: 'fit' | 'wrap' }): Element;
}
const { module: table, dispose } = await bundled<TableModule>(['src/react/DataTable.tsx']);
after(dispose);

describe('DataTable forms', () => {
  it('keeps the default table unchanged and marks only the form asked for', () => {
    const rows = [['Triangles', 38506]];
    assert.equal(table.DataTable({ rows }).props['data-table-form'], undefined);
    assert.equal(table.DataTable({ rows, form: table.DataTableForm.FIT }).props['data-table-form'], 'fit');
    assert.equal(table.DataTable({ rows, form: table.DataTableForm.WRAP }).props['data-table-form'], 'wrap');
  });
});
