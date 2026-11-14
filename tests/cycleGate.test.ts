import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { GATE, runGate } from './gateFixture.ts';

const WITHOUT_TYPESCRIPT = fileURLToPath(new URL('withoutTypeScript.ts', import.meta.url));
const CYCLE = /error no-circular: src\/(a|b)\.ts/;

/** b uses a's function, and a reads b's type: a cycle that only `import type` closes. */
const TYPE_ONLY = {
  'src/a.ts': "import type { Item } from './b.ts';\nexport const nameOf = (item: Item): string => item.name;\n",
  'src/b.ts': "import { nameOf } from './a.ts';\nexport type Item = { name: string };\n"
    + 'export const label = (item: Item): string => nameOf(item);\n',
};
/** a loads b lazily, and b imports a. */
const LAZY = {
  'src/a.ts': "export const loadName = async (): Promise<string> => (await import('./b.ts')).name;\n",
  'src/b.ts': "import { loadName } from './a.ts';\nexport const name = 'b';\nexport const reload = loadName;\n",
};
/** In JavaScript: b uses a's function, and a names b's type only in a JSDoc import. The TypeScript module gives the
 * repository's tsconfig.json, which includes src, an input. */
const JSDOC = {
  'src/entry.ts': "export const entry = 'src';\n",
  'src/a.mjs': "/** @param {import('./b.mjs').Item} item */\nexport const nameOf = item => item.name;\n",
  'src/b.mjs': "import { nameOf } from './a.mjs';\n/** @typedef {{ name: string }} Item */\n"
    + 'export const label = item => nameOf(item);\n',
};
/** TYPE_ONLY with the type moved to a leaf both import. */
const LEAF = {
  'src/item.ts': 'export type Item = { name: string };\n',
  'src/a.ts': "import type { Item } from './item.ts';\nexport const nameOf = (item: Item): string => item.name;\n",
  'src/b.ts': "import type { Item } from './item.ts';\nimport { nameOf } from './a.ts';\n"
    + 'export const label = (item: Item): string => nameOf(item);\n',
};

const cycles = (files: Record<string, string>) => runGate(GATE.cycles, files, process.env);

describe('the cycle gate', () => {
  it('refuses a cycle that only an import type closes', () => {
    const run = cycles(TYPE_ONLY);
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, CYCLE);
  });
  it('refuses a cycle that a lazy import() closes', () => {
    const run = cycles(LAZY);
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, CYCLE);
  });
  it('refuses a cycle that only a JSDoc import closes', () => {
    const run = cycles(JSDOC);
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /error no-circular: src\/(a|b)\.mjs/);
  });
  it('exits 1 for several cycles, not their count, which an exit status keeps only mod 256', () => {
    const second = Object.fromEntries(Object.entries(LAZY).map(([file, text]) =>
      [file.replace('src/', 'src/second/'), text]));
    const run = cycles({ ...TYPE_ONLY, ...second });
    assert.match(run.output, /x 2 dependency violations/);
    assert.equal(run.status, 1, run.output);
  });
  it('passes the same modules once the shared type is a leaf', () => {
    const run = cycles(LEAF);
    assert.equal(run.status, 0, run.output);
    assert.match(run.output, /no dependency violations found \(3 modules/);
  });
  it('refuses a cruise that read no TypeScript, which would pass the cycle', () => {
    const env = { ...process.env, NODE_OPTIONS: `--import ${WITHOUT_TYPESCRIPT}` };
    const run = runGate(GATE.cycles, TYPE_ONLY, env);
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /cycle gate: dependency-cruiser loaded no TypeScript compiler it supports/);
  });
});
