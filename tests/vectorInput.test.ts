import assert from 'node:assert/strict';
import {after, describe, it} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {bundled} from './bundled.ts';

type VectorSuite = typeof import('../src/react/inputs/ModuleVectorInput.tsx')
  & Pick<typeof import('../src/synth/StyleContext.tsx'), 'StyleProvider'>;

const {module, dispose} = await bundled<VectorSuite>([
  'src/react/inputs/ModuleVectorInput.tsx',
  'src/synth/StyleContext.tsx',
]);
after(dispose);

describe('ModuleVectorInput axis sublation', () => {
  it('renders 3 columns when z is present and 2 columns omitting z when planar', () => {
    assert.deepEqual(module.vectorAxes({x: 3, y: 4, z: 5}), [
      {axis: 'x', value: 3},
      {axis: 'y', value: 4},
      {axis: 'z', value: 5},
    ]);
    assert.deepEqual(module.vectorAxes({x: 3, y: 4}), [
      {axis: 'x', value: 3},
      {axis: 'y', value: 4},
    ]);

    const spatial = renderToStaticMarkup(createElement(module.StyleProvider, {
      persist: false,
      children: createElement(module.ModuleVectorInput, {label: 'Offset', vector: {x: 1, y: 2, z: 3}, onAxis() {}}),
    }));
    assert.match(spatial, /repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(spatial, /data-vector-axis="z"/);

    const planar = renderToStaticMarkup(createElement(module.StyleProvider, {
      persist: false,
      children: createElement(module.ModuleVectorInput, {label: 'Offset', vector: {x: 1, y: 2}, onAxis() {}}),
    }));
    assert.match(planar, /repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(planar, /data-vector-axis="x"/);
    assert.match(planar, /data-vector-axis="y"/);
    assert.doesNotMatch(planar, /data-vector-axis="z"/);
  });
});
