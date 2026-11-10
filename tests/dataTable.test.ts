import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
interface Element { type: string; props: Record<string, unknown> }
interface TableModule {
  DataTableForm: { readonly FIT: 'fit' };
  DataTable(props: { head?: string[]; rows: (string | number)[][]; form?: 'fit' }): Element;
}

describe('DataTable fit form', () => {
  let directory = '', table: TableModule;
  before(async () => {
    directory = mkdtempSync(join(root, '.table-form-'));
    const output = await build({ absWorkingDir: root, entryPoints: ['src/react/DataTable.tsx'], bundle: true,
      write: false, format: 'esm', platform: 'node', external: ['react', 'react/*'] });
    const file = join(directory, 'DataTable.mjs');
    writeFileSync(file, output.outputFiles[0].text);
    table = await import(pathToFileURL(file).href);
  });
  after(() => rmSync(directory, { recursive: true, force: true }));

  it('keeps the default table unchanged and marks only the fit form', () => {
    const rows = [['Triangles', 38506]];
    assert.equal(table.DataTable({ rows }).props['data-table-form'], undefined);
    assert.equal(table.DataTable({ rows, form: table.DataTableForm.FIT }).props['data-table-form'], 'fit');
  });
});
