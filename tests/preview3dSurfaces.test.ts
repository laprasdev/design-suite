import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {modelSurfaceKind, modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {MODEL_FILE_ENTRY, modelSurfaceRecordsFit, modelSurfaceSets} from '../src/react/preview3d/surfaceModel.ts';
import {modelFileRenderers, modelSurfaceSetCovers} from '../src/react/preview3d/renderers.ts';
import {modelStageDescription, modelStageDescriptionChanges} from '../src/react/preview3d/descriptionModel.ts';
import {createModelStageParts} from '../src/react/preview3d/stageParts.ts';
import {createModelFog} from '../src/react/preview3d/fog.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {modelStagePolicy} from '../src/react/preview3d/model.ts';
import {actorAsset, actorContext, declaration, describing} from './preview3dActorFixture.ts';
import {createModelActor} from '../src/react/preview3d/actor.ts';

// The kind the seam is proven with: tests only, never shipped.
const PULSE = {id: 'test-pulse', parameters: {_Color: {type: 'color', space: 'srgb', hdr: false},
  _Pulse: {type: 'float'}, _Rim: {type: 'float'}, _Offset: {type: 'vector', size: 2},
  _Mask: {type: 'texture', space: 'linear'}}, inert: {_Rim: 0}, attributes: ['uv'], light: 'standard',
coverage: 'opaque', side: 'front', fog: true, displacement: null, webProgram: {path: '/pulse.glsl',
  sha256: 'a'.repeat(64)}};
const MASK = {path: '/mask.png', sha256: 'b'.repeat(64), wrap: ['repeat', 'clamp'], scale: [1, 1], offset: [0, 0]};
const RECORD = {kind: 'test-pulse', values: {_Color: {color: [1, 0.5, 0, 1]}, _Pulse: {float: 2}, _Rim: {float: 0},
  _Offset: {vector: [0, 1]}, _Mask: {texture: MASK}}};
const RENDERER = 'gltf-node:0/primitive:0';
const kinds = () => modelSurfaceKinds([PULSE]);
const sets = (entry: unknown) => modelSurfaceSets({tinted: {[RENDERER]: entry}});
const refused = (run: () => unknown, pattern: RegExp) => assert.throws(run, (error: unknown) =>
  error instanceof ModelStageRefusal && pattern.test(error.message), String(pattern));
// A loaded file as the loader associates it: node 2 holds a mesh of two primitives, node 3 one line.
function file() {
  const scene = new THREE.Group(), node = new THREE.Group(), associations = new Map<object, object>();
  const [first, second] = [0, 1].map(() => new THREE.Mesh(new THREE.BoxGeometry()));
  const line = new THREE.Line(new THREE.BufferGeometry());
  node.add(first, second);
  scene.add(node, line);
  associations.set(node, {nodes: 2});
  associations.set(first, {meshes: 0, primitives: 0});
  associations.set(second, {meshes: 0, primitives: 1});
  associations.set(line, {nodes: 3, meshes: 1, primitives: 0});
  return {scene, parser: {associations}} as never;
}

describe('surface kinds, records and sets', () => {
  it('takes a kind\'s declaration as data and refuses one that is not whole, by its path', () => {
    assert.equal(modelSurfaceKind(PULSE, 'K').parameters._Color.type, 'color');
    const kind = (change: object, pattern: RegExp) => refused(() => modelSurfaceKind({...PULSE, ...change}, 'K'),
      pattern);
    kind({id: 'file'}, /K.id file is the file's own material's/);
    kind({inert: {_Color: 1}}, /K.inert names _Color, which is not a declared float parameter/);
    kind({displacement: {reach: '_Missing'}}, /K.displacement.reach names _Missing, which is not a declared float/);
    for (const sha256 of ['XYZ', 'A'.repeat(64), 'a'.repeat(63)]) {
      kind({webProgram: {path: '/p.glsl', sha256}}, /K.webProgram.sha256 must be a SHA-256: 64 lowercase hex digits/);
    }
    kind({webProgram: {path: '', sha256: 'a'.repeat(64)}}, /K.webProgram.path must be a non-empty string/);
    kind({coverage: 'fuzzy'}, /K.coverage is one of opaque, cutout, blended/);
    kind({parameters: {_V: {type: 'vector', size: 5}}}, /K.parameters._V.size is one of 2, 3, 4/);
    kind({parameters: {_C: {type: 'color', space: 'srgb'}}}, /K.parameters._C omits hdr/);
    kind({parameters: {_C: {type: 'hue'}}}, /K.parameters._C states its type, one of color, vector/);
    kind({attributes: ['uv', 'uv']}, /K.attributes lists uv twice/);
    kind({fog: 'yes'}, /K.fog is stated as true or false/);
    kind({shade: 1}, /K does not state shade/);
    refused(() => modelSurfaceKinds([PULSE, PULSE]), /Surface kind 1.id test-pulse is already surface kind 0's/);
    // A stage is given its kinds when it is made, as data, and none is a stated empty list.
    const options = {reviewKey: 'review', clock: 'local', floor: false, grid: false} as const;
    assert.equal(modelStagePolicy({...options, kinds: [PULSE as never]}).kinds.get('test-pulse')?.webProgram.path,
      '/pulse.glsl');
    refused(() => modelStagePolicy({...options} as never), /The stage's surface kinds is a list/);
  });

  it('checks a set\'s renderer ids and value forms without its kind, by renderer and parameter', () => {
    refused(() => modelSurfaceSets({tinted: {'node 0': {kind: 'file'}}}),
      /Surface set tinted: node 0 is not a renderer/);
    const where = `Surface set tinted, renderer ${RENDERER}`;
    refused(() => sets({kind: 'test-pulse', values: {_Pulse: {float: 1, color: [1, 1, 1, 1]}}}),
      new RegExp(`${where}._Pulse states exactly one of color, vector, float, keyword, texture`));
    refused(() => sets({...RECORD, values: {...RECORD.values, _Color: {color: [1, -1, 0, 1]}}}),
      /_Color.color has a channel below 0/);
    refused(() => sets({...RECORD, values: {...RECORD.values, _Mask: {texture: {...MASK, wrap: ['repeat', 'tile']}}}}),
      /_Mask.texture.wrap\[1\] is one of repeat, clamp, mirror/);
    refused(() => sets({...RECORD, values: {...RECORD.values, _Mask: {texture: {constant: 'grey'}}}}),
      /_Mask.texture.constant is one of white, black/);
    refused(() => sets({kind: 'file', values: {}}), new RegExp(`${where} does not state values`));
    assert.deepEqual(sets({kind: 'file'}).tinted[RENDERER], MODEL_FILE_ENTRY);
    assert.deepEqual(sets(RECORD).tinted[RENDERER], RECORD);
  });

  it('fits a record to its kind: every parameter, of its type and size, in range, and inert ones held', () => {
    assert.doesNotThrow(() => modelSurfaceRecordsFit(sets(RECORD), kinds()));
    const fit = (values: object, pattern: RegExp) =>
      refused(() => modelSurfaceRecordsFit(sets({...RECORD, values: {...RECORD.values, ...values}}), kinds()), pattern);
    const at = `renderer ${RENDERER}, kind test-pulse`;
    fit({_Color: {color: [2, 0, 0, 1]}}, new RegExp(`${at}: _Color is not HDR: each channel is from 0 to 1`));
    fit({_Pulse: {color: [1, 1, 1, 1]}}, /_Pulse is a float; it states a color/);
    fit({_Offset: {vector: [0, 1, 2]}}, /_Offset is a vector of 2/);
    fit({_Rim: {float: 1}}, /_Rim is drawn only at 0/);
    fit({_Extra: {float: 1}}, /kind test-pulse: values does not state _Extra/);
    refused(() => modelSurfaceRecordsFit(sets({...RECORD, kind: 'toon'}), kinds()),
      new RegExp(`renderer ${RENDERER} names kind toon; the stage was given test-pulse`));
  });

  it('lists a file\'s renderers by id, and refuses a set that leaves one out or names one it lacks', () => {
    const renderers = modelFileRenderers(file());
    assert.deepEqual([...renderers.keys()],
      ['gltf-node:2/primitive:0', 'gltf-node:2/primitive:1', 'gltf-node:3/primitive:0']);
    const whole = Object.fromEntries([...renderers.keys()].map(id => [id, MODEL_FILE_ENTRY]));
    assert.doesNotThrow(() => modelSurfaceSetCovers('a', 'own', whole, renderers));
    const {'gltf-node:3/primitive:0': _, ...partial} = whole;
    refused(() => modelSurfaceSetCovers('a', 'own', partial, renderers),
      /Actor a: surface set own leaves out the file's renderers gltf-node:3\/primitive:0/);
    refused(() => modelSurfaceSetCovers('a', 'own', {...whole, 'gltf-node:9/primitive:0': MODEL_FILE_ENTRY},
      renderers), /names renderers the file does not have: gltf-node:9\/primitive:0/);
  });

  it('checks, while preparing, that an actor drawn from a set names exactly its file\'s renderers', () => {
    const {asset, body} = actorAsset([{name: 'run', duration: 1}]);
    const associated = {...asset, parser: {associations: new Map([[body, {nodes: 0, meshes: 0, primitives: 0}]])}};
    const actor = createModelActor(associated as never, declaration('a', 'otter',
      {surfaces: {kind: 'set', set: 'own'}}), actorContext().context);
    const parts = createModelStageParts({scene: new THREE.Scene(), kinds: kinds(), frame: () => undefined,
      lighting: {load: () => [], prepare: () => () => undefined}, fog: createModelFog(new THREE.Scene())});
    const describedWith = (set: object) => modelStageDescription(describing({surfaceSets: {own: set},
      actors: {focus: 'a', actors: [actor.declaration]}}));
    const prepare = (next: ReturnType<typeof describedWith>) =>
      parts.prepares(next, modelStageDescriptionChanges(undefined, next), [actor]).map(each => each());
    assert.doesNotThrow(() => prepare(describedWith({[RENDERER]: {kind: 'file'}})));
    refused(() => prepare(describedWith({[RENDERER]: {kind: 'file'}, 'gltf-node:1/primitive:0': {kind: 'file'}})),
      /Actor a: surface set own names renderers the file does not have: gltf-node:1\/primitive:0/);
    refused(() => prepare(describedWith({})), /Actor a: surface set own leaves out the file's renderers/);
    actor.dispose();
  });

  it('refuses an actor naming a set the description lacks, and a record the stage cannot draw yet', () => {
    refused(() => modelStageDescription(describing({actors: {focus: 'a', actors: [
      declaration('a', 'otter', {surfaces: {kind: 'set', set: 'tinted'}})]}})),
    /Actor a.surfaces.set names surface set tinted; the description's sets are none/);
    const next = modelStageDescription(describing({surfaceSets: {tinted: {[RENDERER]: RECORD}}}));
    const parts = createModelStageParts({scene: new THREE.Scene(), kinds: kinds(), frame: () => undefined,
      lighting: {load: () => [], prepare: () => () => undefined}, fog: createModelFog(new THREE.Scene())});
    refused(() => parts.prepares(next, modelStageDescriptionChanges(undefined, next), []).map(prepare => prepare()),
      new RegExp(`Surface set tinted, renderer ${RENDERER}: the stage cannot draw kind test-pulse yet`));
  });
});
