// PipRow's compact form is opt-in: the meter stays the default, writes no form and keeps its rules, and a form outside
// PipRowForm fails the type check.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {after, describe, it} from 'node:test';
import {spawnSync} from 'node:child_process';
import {SUITE_ROOT, bundled} from './bundled.ts';

interface Element { props: {className: string; 'data-form'?: string; children: {props: {'data-on': string}}[]} }
interface PipRowModule {
  PipRow(props: {value: number; max: number; segments: number; form?: string}): Element;
  PipRowForm: {METER: string; COMPACT: string};
}

const {module, directory: dir, dispose} = await bundled<PipRowModule>(['src/react/PipRow.tsx']);
after(dispose);

describe('PipRow forms', () => {
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
    const css = readFileSync(join(SUITE_ROOT, 'src/react/widgets.css'), 'utf8');
    assert.match(css, /\.bd-piprow \{[^}]*width: 100%;/);
    assert.match(css, /\.bd-pip \{[^}]*flex: 1 1 0;/);
    const compact = `.bd-piprow[data-form="${module.PipRowForm.COMPACT}"]`;
    assert.ok(css.includes(`${compact} { width: auto; }`));
    assert.ok(css.includes(`${compact} > .bd-pip { flex: none; width: 8px; }`));
  });

  it('refuses a form outside PipRowForm at the type check', () => {
    const {compilerOptions} = JSON.parse(readFileSync(join(SUITE_ROOT, 'tsconfig.json'), 'utf8'));
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({files: ['usage.tsx'], compilerOptions}));
    const check = (form: string) => {
      const pipRow = JSON.stringify(join(SUITE_ROOT, 'src/react/PipRow.tsx'));
      writeFileSync(join(dir, 'usage.tsx'), `import {PipRow, PipRowForm} from ${pipRow};\n` +
        `export const row = <PipRow value={1} max={3} segments={3} form={${form}} />; void PipRowForm;\n`);
      return spawnSync(join(SUITE_ROOT, 'node_modules/.bin/tsc'),
        ['-p', join(dir, 'tsconfig.json'), '--pretty', 'false'], {encoding: 'utf8'});
    };
    const valid = check('PipRowForm.COMPACT');
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const invalid = check("'wide'");
    assert.notEqual(invalid.status, 0);
    assert.deepEqual(invalid.stdout.match(/error TS\d+/g), ['error TS2322']);
  });
});
