import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {modelSurfaceRecordsFit, modelSurfaceSets} from '../src/react/preview3d/surfaceModel.ts';
import {modelStageDescription} from '../src/react/preview3d/descriptionModel.ts';
import {modelFileRenderers} from '../src/react/preview3d/renderers.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {declaration, describing} from './preview3dActorFixture.ts';
import {kindFile, MASK, PULSE, RENDERERS} from './preview3dKindFixture.ts';

// The record owner reads only a record's own fields, and builds a record keyed by the data's own names with no
// prototype: a name every object inherits (`valueOf`, `toString`, `constructor`) is data like any other.
const refused = (run: () => unknown, pattern: RegExp) =>
  assert.throws(run, (error: unknown) => error instanceof ModelStageRefusal && pattern.test(error.message));
const kind = (parameters: Record<string, unknown>) => modelSurfaceKinds([{...PULSE, id: 'k', parameters, inert: {}}]);
const set = (values: Record<string, unknown>) => modelSurfaceSets({s: {[RENDERERS.body]: {kind: 'k', values}}});

describe('records keyed by the data\'s own names', () => {
  it('takes a parameter named as an inherited name, and refuses a record that leaves one out', () => {
    const kinds = kind({valueOf: {type: 'float'}, toString: {type: 'float'}});
    modelSurfaceRecordsFit(set({valueOf: {float: 2}, toString: {float: 3}}), kinds);
    refused(() => modelSurfaceRecordsFit(set({valueOf: {float: 2}}), kinds), /values omits toString; it states/);
    refused(() => modelSurfaceRecordsFit(set({valueOf: {float: 2}, toString: {float: 3}, hasOwnProperty: {float: 1}}),
      kinds), /does not state hasOwnProperty/);
  });

  it('finds no surface set by an inherited name', () => {
    refused(() => modelStageDescription(describing({actors: {focus: 'a', actors: [declaration('a', 'otter',
      {surfaces: {from: 'set', set: 'constructor'}})]}})),
    /Actor a.surfaces.set names surface set constructor; the description's sets are none/);
  });

  it('names what a record of the data\'s own names holds, when it is not one', () => {
    refused(() => modelSurfaceSets([]), /^The surfaceSets is a record of surface sets by name\.$/);
    refused(() => modelSurfaceSets({s: 4}), /^Surface set s is a record of entries by renderer id\.$/);
    refused(() => modelSurfaceKinds([{...PULSE, parameters: null}]),
      /^Surface kind 0.parameters is a record of parameters by name\.$/);
  });
});

describe('refusals that name what failed and where', () => {
  it('refuses a texture\'s wrap that is not a pair as such, listing the wraps', () => {
    const texture = (wrap: unknown) => set({_Mask: {texture: {...MASK, wrap}}});
    for (const wrap of [['repeat', 'repeat', 'repeat'], 'repeat', ['repeat']]) {
      refused(() => texture(wrap), /_Mask.texture.wrap is a pair, \[u, v\], each one of repeat, clamp, mirror\./);
    }
    refused(() => texture(['repeat', 'tile']), /_Mask.texture.wrap\[1\] is one of repeat, clamp, mirror/);
  });

  it('names the actor and the file when a file draws a renderer the loader gave no primitive', () => {
    const {asset, line} = kindFile();
    (asset as {parser: {associations: Map<object, object>}}).parser.associations.delete(line);
    refused(() => modelFileRenderers(asset, 'blue', '/models/blue.glb'),
      /^Actor blue: \/models\/blue.glb draws \(unnamed\), which the loader gave no glTF primitive\.$/);
  });
});
