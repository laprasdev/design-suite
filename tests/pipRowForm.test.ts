// PipRow's compact form is opt-in: the meter stays the default, writes no form and keeps its rules, and a form outside
// PipRowForm fails the type check.
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {after, before, describe, it} from 'node:test';
import {spawnSync} from 'node:child_process';
import {build} from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
interface Element { props: {className: string; 'data-form'?: string; children: {props: {'data-on': string}}[]} }
interface PipRowModule {
  PipRow(props: {value: number; max: number; segments: number; form?: string}): Element;
  PipRowForm: {METER: string; COMPACT: string};
}

describe('PipRow forms', () => {
  let dir = '', module: PipRowModule;
  before(async () => {
    dir = mkdtempSync(join(root, '.piprow-form-'));
    const output = await build({absWorkingDir: root, entryPoints: ['src/react/PipRow.tsx'], bundle: true,
      write: false, format: 'esm', platform: 'node', external: ['react', 'react/*']});
    const file = join(dir, 'PipRow.mjs');
    writeFileSync(file, output.outputFiles[0].text);
    module = await import(pathToFileURL(file).href);
  });
  after(() => rmSync(dir, {recursive: true, force: true}));

  it('keeps the meter as the default and writes no form for it', () => {
    const row = module.PipRow({value: 2, max: 3, segments: 3});
    assert.equal(row.props.className, 'bd-piprow');
    assert.equal(row.props['data-form'], undefined);
    assert.deepEqual(row.props.children.map(pip => pip.props['data-on']), ['true', 'true', 'false']);
    assert.equal(module.PipRow({value: 2, max: 3, segments: 3, form: module.PipRowForm.METER}).props['data-form'],
      undefined);
  });

  it('names the compact form on the row, with the same pips', () => {
    const row = module.PipRow({value: 2, max: 3, segments: 3, form: module.PipRowForm.COMPACT});
    assert.equal(row.props['data-form'], 'compact');
    assert.deepEqual(row.props.children.map(pip => pip.props['data-on']), ['true', 'true', 'false']);
  });

  it('keeps the meter rules and scopes the compact rules to its form', () => {
    const css = readFileSync(join(root, 'src/react/widgets.css'), 'utf8');
    assert.match(css, /\.bd-piprow \{[^}]*width: 100%;/);
    assert.match(css, /\.bd-pip \{[^}]*flex: 1 1 0;/);
    const compact = `.bd-piprow[data-form="${module.PipRowForm.COMPACT}"]`;
    assert.ok(css.includes(`${compact} { width: auto; }`));
    assert.ok(css.includes(`${compact} > .bd-pip { flex: none; width: 8px; }`));
  });

  it('refuses a form outside PipRowForm at the type check', () => {
    const {compilerOptions} = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'));
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({files: ['usage.tsx'], compilerOptions}));
    const check = (form: string) => {
      writeFileSync(join(dir, 'usage.tsx'), "import {PipRow, PipRowForm} from '../src/react/PipRow.tsx';\n" +
        `export const row = <PipRow value={1} max={3} segments={3} form={${form}} />; void PipRowForm;\n`);
      return spawnSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(dir, 'tsconfig.json'), '--pretty', 'false'],
        {encoding: 'utf8'});
    };
    const valid = check('PipRowForm.COMPACT');
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const invalid = check("'wide'");
    assert.notEqual(invalid.status, 0);
    assert.deepEqual(invalid.stdout.match(/error TS\d+/g), ['error TS2322']);
  });
});
