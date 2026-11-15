import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GATE, runGate } from './gateFixture.ts';

const VALID_SOURCE = "export const answer = (value: number): number => value + 1;\n";

const AUGMENTATION = [
  "import 'react';",
  'type CustomVars = { [name: `--${string}`]: string | number | undefined };',
  "declare module 'react' {",
  '  interface CSSProperties extends CustomVars {}',
  '}',
  '',
].join('\n');

const types = (files: Record<string, string>) => runGate(GATE.types, files, process.env);

describe('the type gate', () => {
  it('refuses a JavaScript module anywhere in the repository', () => {
    const run = types({ 'src/ok.ts': VALID_SOURCE, 'scripts/legacy.mjs': 'export const legacy = 1;\n' });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /scripts\/legacy\.mjs: JavaScript module/);
  });

  it('refuses a declaration sidecar while permitting external module augmentation', () => {
    const sidecar = types({
      'src/ok.ts': VALID_SOURCE,
      'src/helper.d.ts': 'export declare function helper(): string;\n',
    });
    assert.equal(sidecar.status, 1, sidecar.output);
    assert.match(sidecar.output, /src\/helper\.d\.ts: declaration sidecar/);

    const augmentation = types({ 'src/ok.ts': VALID_SOURCE, 'src/react-css.d.ts': AUGMENTATION });
    assert.equal(augmentation.status, 0, augmentation.output);
  });

  it('refuses a TypeScript module that tsconfig.repo.json does not include', () => {
    const run = types({ 'src/ok.ts': VALID_SOURCE, 'tools/uncovered.ts': VALID_SOURCE });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /tools\/uncovered\.ts: not covered by tsconfig\.repo\.json/);
  });

  it('refuses explicit any and compiler suppression comments, including inside JSX', () => {
    const withAny = types({ 'src/bad.ts': 'export const read = (input: any): string => String(input);\n' });
    assert.equal(withAny.status, 1, withAny.output);
    assert.match(withAny.output, /src\/bad\.ts:1: explicit any/);

    const suppressed = types({
      'src/suppressed.ts': '// @ts-expect-error hidden mismatch\nexport const count: number = "two";\n',
    });
    assert.equal(suppressed.status, 1, suppressed.output);
    assert.match(suppressed.output, /src\/suppressed\.ts:1: compiler suppression comment/);

    const jsxSuppressed = types({
      'src/View.tsx': 'export const View = () => <div>{/* @ts-ignore */}<span>ok</span></div>;\n',
    });
    assert.equal(jsxSuppressed.status, 1, jsxSuppressed.output);
    assert.match(jsxSuppressed.output, /src\/View\.tsx:1: compiler suppression comment/);
  });

  it('refuses a weakened tsconfig.repo.json or a repository with no TypeScript files', () => {
    const empty = types({ 'README.md': '# Empty\n' });
    assert.equal(empty.status, 1, empty.output);
    assert.match(empty.output, /type gate: found no TypeScript files/);

    const withExclude = types({
      'src/ok.ts': VALID_SOURCE,
      'tsconfig.repo.json': JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { types: ['node'], allowJs: false },
        include: ['src'],
        exclude: ['src/ignored.ts'],
      }),
    });
    assert.equal(withExclude.status, 1, withExclude.output);
    assert.match(withExclude.output, /tsconfig\.repo\.json must not declare exclude/);

    const allowJs = types({
      'src/ok.ts': VALID_SOURCE,
      'tsconfig.repo.json': JSON.stringify({
        extends: './tsconfig.json',
        compilerOptions: { types: ['node'], allowJs: true },
        include: ['src'],
      }),
    });
    assert.equal(allowJs.status, 1, allowJs.output);
    assert.match(allowJs.output, /tsconfig\.repo\.json must hold allowJs: false/);
  });

  it('passes strict TypeScript modules and leaves string literals mentioning directives untouched', () => {
    const run = types({
      'src/ok.ts': `${VALID_SOURCE}export const note = '// @ts-ignore in a literal is data';\n`,
    });
    assert.equal(run.status, 0, run.output);
    assert.match(run.output, /type gate: 1 TypeScript files checked, 0 JavaScript modules/);
  });
});
