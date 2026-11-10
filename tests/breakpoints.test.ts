import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {Breakpoint} from '../src/react/breakpoints.ts';

const react = fileURLToPath(new URL('../src/react/', import.meta.url));
// Every width a media query's prelude caps, in any position and in legacy or range syntax.
const PRELUDE = /@media([^{]*)\{/g, CAPS = [/max-width\s*:\s*(\d+)px/g, /width\s*<=?\s*(\d+)px/g];
const stylesheets = readdirSync(react, {recursive: true, encoding: 'utf8'}).filter(file => file.endsWith('.css'));
const widthsIn = (file: string) => [...readFileSync(join(react, file), 'utf8').matchAll(PRELUDE)]
 .flatMap(([, prelude]) => CAPS.flatMap(cap => [...prelude.matchAll(cap)].map(match => Number(match[1]))));

test('every max-width media query under src/react breaks at a named breakpoint', () => {
 const named = new Set<number>(Object.values(Breakpoint));
 const unnamed = stylesheets.flatMap(file => widthsIn(file).filter(width => !named.has(width))
  .map(width => `${file}: ${width}px`));
 assert.deepEqual(unnamed, []);
});

test('every named breakpoint is one the stylesheets use', () => {
 const used = new Set(stylesheets.flatMap(widthsIn));
 assert.deepEqual(Object.entries(Breakpoint).filter(([, width]) => !used.has(width)).map(([name]) => name), []);
});
