import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isRecord } from '../src/valueChecks.ts';
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

/** The options the gate requires, as the shared policy states them; each case flips one. */
const REQUIRED_OPTIONS = {
  strict: true, noEmit: true, erasableSyntaxOnly: true, verbatimModuleSyntax: true, allowJs: false,
} as const;
type Config = Record<string, unknown> & { compilerOptions: Record<string, unknown> };

/** A committed configuration, which a case rewrites in its fixture. */
function readConfig(file: string): Config {
  const config: unknown = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  if (!isRecord(config) || !isRecord(config.compilerOptions)) throw new Error(`${file} holds no compilerOptions.`);
  return { ...config, compilerOptions: config.compilerOptions };
}
const BASE_CONFIG = readConfig('tsconfig.json');
const REPO_CONFIG = readConfig('tsconfig.repo.json');

const types = (files: Record<string, string>) => runGate(GATE.types, files, process.env);

describe('the type gate', () => {
  it('refuses a JavaScript module anywhere in the repository', () => {
    const run = types({ 'src/ok.ts': VALID_SOURCE, 'scripts/legacy.mjs': 'export const legacy = 1;\n' });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /scripts\/legacy\.mjs: JavaScript module/);
  });

  it('refuses a declaration file of any extension unless it only augments a module', () => {
    for (const file of ['src/helper.d.ts', 'src/helper.d.mts', 'src/helper.d.cts']) {
      const declaration = types({ 'src/ok.ts': VALID_SOURCE, [file]: 'export declare function helper(): string;\n' });
      assert.equal(declaration.status, 1, declaration.output);
      assert.match(declaration.output, new RegExp(`${file.replaceAll('.', '\\.')}: declaration file that augments no`));
    }
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

  it('refuses a repository with no TypeScript files', () => {
    const empty = types({ 'README.md': '# Empty\n' });
    assert.equal(empty.status, 1, empty.output);
    assert.match(empty.output, /type gate: found no TypeScript files/);
  });

  it('refuses each required compiler option weakened in the effective configuration', () => {
    for (const [option, value] of Object.entries(REQUIRED_OPTIONS)) {
      const weakened = types({
        'src/ok.ts': VALID_SOURCE,
        'tsconfig.repo.json': JSON.stringify({
          ...REPO_CONFIG, compilerOptions: { ...REPO_CONFIG.compilerOptions, [option]: !value },
        }),
      });
      assert.equal(weakened.status, 1, weakened.output);
      assert.match(weakened.output, new RegExp(`tsconfig\\.repo\\.json must hold ${option}: ${value}`));
    }
  });

  it('refuses a module an inherited exclude leaves out', () => {
    const run = types({
      'src/ok.ts': VALID_SOURCE,
      'src/excluded.ts': VALID_SOURCE,
      'tsconfig.json': JSON.stringify({ ...BASE_CONFIG, exclude: ['src/excluded.ts'] }),
    });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /src\/excluded\.ts: not covered by tsconfig\.repo\.json/);
  });

  it('refuses a module that does not compile, with no comment to find', () => {
    const run = types({ 'src/ok.ts': VALID_SOURCE, 'src/wrong.ts': "export const count: number = 'two';\n" });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /src\/wrong\.ts\(1,14\): error TS2322/);
  });

  it('passes strict TypeScript modules and leaves string literals mentioning directives untouched', () => {
    const run = types({
      'src/ok.ts': `${VALID_SOURCE}export const note = '// @ts-ignore in a literal is data';\n`,
    });
    assert.equal(run.status, 0, run.output);
    assert.match(run.output, /type gate: 1 TypeScript files checked, 0 JavaScript modules/);
  });
});
