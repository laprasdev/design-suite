import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {flattenSkin, resolveDesignSystem} from '../src/skins.ts';
import {
  mergeComposable, resolveBaseComposable, resolveComponentComposable, resolveContainerComposable, type HciDataComposable,
} from '../src/synth/design/Composable.ts';

const skin = flattenSkin(resolveDesignSystem('serum'));
const empty: HciDataComposable = {
  palette: null, sizing: null, spacing: null, contentShape: null, text: null, edge: null, shadow: null, glyph: null,
};

describe('resolving composables from a skin', () => {
  it('reads the base composable', () => assert.ok(resolveBaseComposable(skin)));

  for (const container of ['module', 'cutout', 'button']) {
    it(`reads the ${container} container`, () => assert.ok(resolveContainerComposable(skin, container)));
  }

  for (const component of ['knob', 'slider', 'tabs']) {
    it(`reads the ${component} component`, () => assert.ok(resolveComponentComposable(skin, component)));
  }

  it('reads what a container declares', () => {
    assert.equal(resolveContainerComposable(skin, 'module').contentShape?.cornerRadius, 0);
    assert.deepEqual(resolveContainerComposable(skin, 'module').spacing?.padding, [0, 0]);
  });
});

describe('merging composables', () => {
  const parent: HciDataComposable = {
    ...empty,
    sizing: {scaleOffset: 0, aspectRatio: null},
    spacing: {padding: [4, 4]},
    contentShape: {cornerRadius: 8},
    text: {kern: 0.05, lead: 1.2, weight: 500},
    edge: {width: 1, outset: 0},
  };

  it('a child overrides the parts it declares', () => {
    const merged = mergeComposable(parent, {...empty, sizing: {scaleOffset: 2, aspectRatio: null}, contentShape: {cornerRadius: 4}});
    assert.equal(merged.sizing?.scaleOffset, 2);
    assert.equal(merged.contentShape?.cornerRadius, 4);
    assert.deepEqual(merged.spacing?.padding, [4, 4]);
    assert.equal(merged.text?.weight, 500);
    assert.equal(merged.edge?.width, 1);
  });

  it('an empty child inherits everything', () => {
    const merged = mergeComposable(parent, empty);
    assert.equal(merged.sizing?.scaleOffset, 0);
    assert.equal(merged.text?.weight, 500);
  });
});
