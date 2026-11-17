import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUITE_BASELINE } from '../scripts/size-gate.ts';
import { readBaseline } from '../scripts/sizeGate/baselineFile.ts';
import { CAST_BASELINE, castBaselineText, type CastNumbers } from '../scripts/typeGate/castBaseline.ts';
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

/** A fixture's cast baseline, which names no file unless a case gives its numbers. */
const castBaseline = (files: Record<string, CastNumbers>) => ({ [CAST_BASELINE]: castBaselineText({ files }) });
const SIZE_SCOPE = readBaseline(fileURLToPath(new URL(`../${SUITE_BASELINE}`, import.meta.url))).scope;
const types = (files: Record<string, string>) =>
  runGate(GATE.types, { base: {}, head: { ...castBaseline({}), ...files } }, process.env);

describe('the type gate', () => {
  it('refuses a JavaScript module anywhere in the repository', () => {
    const run = types({ 'src/ok.ts': VALID_SOURCE, 'scripts/legacy.mjs': 'export const legacy = 1;\n' });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /scripts\/legacy\.mjs: JavaScript module/);
  });

  it('inspects a dist folder below the root, which tsc compiles', () => {
    const nestedDist = types({
      'src/ok.ts': VALID_SOURCE,
      'src/dist/legacy.js': 'export const legacy = 1;\n',
      'src/dist/legacy.d.ts': 'export declare const legacy: number;\n',
    });
    assert.equal(nestedDist.status, 1, nestedDist.output);
    assert.match(nestedDist.output, /src\/dist\/legacy\.js: JavaScript module/);
    assert.match(nestedDist.output, /src\/dist\/legacy\.d\.ts: declaration file that augments no/);
  });

  it('inspects a __snapshots__ folder below the root, which tsc compiles', () => {
    const nestedSnapshots = types({
      'src/ok.ts': VALID_SOURCE,
      'src/__snapshots__/hidden.ts': '// @ts-ignore\nexport const hidden = (input: any): string => input;\n',
    });
    assert.equal(nestedSnapshots.status, 1, nestedSnapshots.output);
    assert.match(nestedSnapshots.output, /src\/__snapshots__\/hidden\.ts:1: compiler suppression comment/);
    assert.match(nestedSnapshots.output, /src\/__snapshots__\/hidden\.ts:2: explicit any/);
  });

  it('skips what .gitignore ignores', () => {
    const run = types({ 'src/ok.ts': VALID_SOURCE, 'dist/bundle.js': 'export const bundle = 1;\n' });
    assert.equal(run.status, 0, run.output);
  });

  it('refuses a file that holds more casts or non-null assertions than its baseline, naming that file alone', () => {
    const source = [
      'export const read = (input: unknown): string => input as string;', 'export const kinds = [1] as const;', '',
    ].join('\n');
    const cast = types({ 'src/ok.ts': VALID_SOURCE, 'src/cast.ts': source });
    assert.equal(cast.status, 1, cast.output);
    assert.match(cast.output, /src\/cast\.ts: 1 casts, baselined 0, at lines 1;/);

    const held = { 'src/held.ts': source, ...castBaseline({ 'src/held.ts': { casts: 1, nonNullAssertions: 0 } }) };
    assert.equal(types(held).status, 0);
    const again = 'export const again = (input: unknown) => input as number;\n';
    const grown = types({ ...held, 'src/grown.ts': `${source}${again}` });
    assert.equal(grown.status, 1, grown.output);
    assert.match(grown.output, /src\/grown\.ts: 2 casts, baselined 0, at lines 1, 3;/);
    assert.doesNotMatch(grown.output, /src\/held\.ts/);

    const nonNull = types({ 'src/first.ts': 'export const first = (list: string[]): string => list[0]!;\n' });
    assert.equal(nonNull.status, 1, nonNull.output);
    assert.match(nonNull.output, /src\/first\.ts: 1 non-null assertions, baselined 0, at lines 1;/);
  });

  it('passes a file that holds fewer than its baseline, and says the ratchet lowers it', () => {
    const baseline = castBaseline({ 'src/ok.ts': { casts: 2, nonNullAssertions: 0 } });
    const run = types({ 'src/ok.ts': VALID_SOURCE, ...baseline });
    assert.equal(run.status, 0, run.output);
    assert.match(run.output, /ratchet: src\/ok\.ts holds 0 casts, baselined 2/);
  });

  it('refuses a size scope that names a JavaScript or TypeScript extension no gate would read', () => {
    const narrowed = { ...SIZE_SCOPE, extensions: ['.ts', '.tsx'] };
    const baseline = JSON.stringify({ scope: narrowed, files: {}, allowances: [] });
    const run = types({ 'src/ok.ts': VALID_SOURCE, [SUITE_BASELINE]: baseline });
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /scripts\/size-baseline\.json names no \.js, \.jsx, \.mjs, \.cjs, \.mts, \.cts source/);
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
    assert.match(run.output, /type gate: 1 TypeScript files checked, 0 JavaScript modules, 0 assertions held/);
  });
});
