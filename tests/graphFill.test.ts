// A graph fill draws its curve in its form: plain as drawn, lit a step brighter at every stop, so the running part of
// a curve stands out from the rest of the same curve.
import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {bundled} from './bundled.ts';

type Module = typeof import('../src/react/GraphDisplay.tsx') & typeof import('../src/react/graphFillForm.ts')
  & typeof import('../src/synth/StyleContext.tsx');
const {module, dispose} = await bundled<Module>(['src/react/GraphDisplay.tsx', 'src/react/graphFillForm.ts',
  'src/synth/StyleContext.tsx']);
const {GraphFill, GraphFillForm, GraphHandle, graphGlowFilter, StyleProvider} = module;
after(dispose);

const AREA = 'M 0,100 L 50,0 L 100,100 Z';
const STOP = /stop-opacity="([\d.]+)"/g;

function drawn(form: typeof GraphFillForm[keyof typeof GraphFillForm]) {
  const children = createElement('svg', null, createElement(GraphFill, {path: AREA, form}));
  const markup = renderToStaticMarkup(createElement(StyleProvider, {persist: false, documentStyles: false, children}));
  return {markup, stops: [...markup.matchAll(STOP)].map(match => Number(match[1]))};
}

describe('a graph fill in each form', () => {
  it('draws its path, marked with its form', () => {
    for (const form of Object.values(GraphFillForm)) {
      const {markup} = drawn(form);
      assert.ok(markup.includes(`<path data-graph-fill="${form}" d="${AREA}"`), form);
    }
  });

  it('lights the lit form brighter than the plain one at every stop', () => {
    const plain = drawn(GraphFillForm.PLAIN).stops, lit = drawn(GraphFillForm.LIT).stops;
    assert.equal(lit.length, plain.length);
    lit.forEach((opacity, index) => assert.ok(opacity > plain[index], `stop ${index}: ${opacity} > ${plain[index]}`));
  });
});

describe('a graph handle', () => {
  it('starts hidden, a circle of its own size in the primary colour wearing the glow its curve wears', () => {
    const markup = renderToStaticMarkup(createElement(StyleProvider, {persist: false, documentStyles: false,
      children: createElement(GraphHandle)}));
    assert.match(markup,
      /<circle data-graph-handle="true" cx="0%" cy="0%" r="3" fill="#[0-9A-Fa-f]{6}" style="visibility:hidden/);
    const color = markup.match(/fill="(#[0-9A-Fa-f]{6})"/)?.[1];
    assert.ok(color, markup);
    assert.ok(markup.includes(`filter:${graphGlowFilter(color)}`), markup);
  });
});
