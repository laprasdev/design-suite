import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelSurfaceProgram, modelSurfaceDrawable} from '../src/react/preview3d/surfaceProgram.ts';
import {modelSurfaceKind} from '../src/react/preview3d/surfaceKindModel.ts';
import {modelSurfaceModesCover} from '../src/react/preview3d/materials.ts';
import {createModelActorSurfaces, MODEL_ACTOR_SURFACES_TEXT as TEXT} from '../src/react/preview3d/actorSurfaces.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {modelSurfaceKinds} from '../src/react/preview3d/surfaceKindModel.ts';
import {modelSurfaceSets} from '../src/react/preview3d/surfaceModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {kindFile, PULSE, RENDERERS} from './preview3dKindFixture.ts';

// What a kind may be beyond a lit surface over uv and colour: unlit, moving its vertices, reading the file's own
// attributes. Test kinds only, beside the seam's own (preview3dKindFixture.ts).
const SWAY_PROGRAM = `void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse.rgb = surfaceParameter_Color().rgb;
}
vec3 kindDisplacement( vec3 world ) {
  return vec3( sin( stageDecorativeSeconds + world.y ) * surfaceParameter_Reach(), 0.0, 0.0 );
}`;
const kind = (change: object) => modelSurfaceKind({...PULSE, id: 'test-form', parameters: {_Color: {type: 'color',
  space: 'srgb', hdr: false}, _Reach: {type: 'float'}}, inert: {}, ...change}, 'K');
const SWAY = kind({displacement: {reach: '_Reach'}});
const UNLIT = kind({light: 'unlit'});
const DEPTH = kind({attributes: ['uv', {name: '_depth', size: 1}]});
const shared = createModelStageSharedValues().declarations;
const program = (value: typeof SWAY) => createModelSurfaceProgram(value, SWAY_PROGRAM, shared);
const at = (source: string, text: string) => {
  const index = source.indexOf(text);
  assert.ok(index >= 0, text);
  return index;
};

describe('a kind\'s forms beyond a lit surface', () => {
  it('draws an unlit kind on three\'s basic program: its colour as stated, plus its emission', () => {
    const built = program(UNLIT), material = built.make(built.baseUniforms());
    assert.deepEqual([material.lights, 'STANDARD' in material.defines, modelSurfaceModesCover(material)],
      [false, false, false], 'unlit, and so not a surface the Surface modes cover');
    const source = built.fragmentShader;
    assert.ok(at(source, '#include <specularmap_fragment>') < at(source, 'kindSurface( diffuseColor, kindEmissive );'));
    assert.ok(at(source, 'vec3 outgoingLight = reflectedLight.indirectDiffuse;') <
      at(source, 'outgoingLight += kindEmissive;'));
    assert.ok(at(source, 'outgoingLight += kindEmissive;') < at(source, '#include <envmap_fragment>'));
    assert.equal(built.vertexShader, THREE.ShaderLib.basic.vertexShader, 'the vertex stage is three\'s own');
  });

  it('moves a kind\'s vertices in one place: given the world position, its offset taken to the object\'s space', () => {
    const built = program(SWAY), source = built.vertexShader;
    assert.ok(at(source, 'vec3 kindDisplacement( vec3 world )') < at(source, 'void main()'), 'its program, declared');
    assert.ok(at(source, 'uniform vec2 stageNumbers;') < at(source, 'void main()'), 'the shared values, declared');
    assert.ok(at(source, '#include <skinning_vertex>') < at(source, 'kindDisplacement( kindWorld )'));
    assert.ok(at(source, 'kindDisplacement( kindWorld )') < at(source, '#include <project_vertex>'));
    assert.ok(at(source, '#include <project_vertex>') < at(source, '#include <fog_vertex>'), 'the fog follows');
    assert.match(source, /kindObjectToWorld = kindObjectToWorld \* instanceMatrix;/);
    assert.match(source,
      /transformed \+= inverse\( mat3\( kindObjectToWorld \) \) \* kindDisplacement\( kindWorld \);/);
    assert.equal(program(kind({})).vertexShader, THREE.ShaderLib.standard.vertexShader, 'a still kind: three\'s own');
    assert.ok(at(source, '#define KIND_VERTEX_STAGE') < at(source, 'vec3 kindDisplacement( vec3 world )'));
    assert.ok(!built.fragmentShader.includes('KIND_VERTEX_STAGE'), 'defined in the vertex stage only');
    // Moving and reading a file's own attribute: its varying declared once in each stage.
    const both = program(kind({displacement: {reach: '_Reach'}, attributes: ['uv', {name: '_depth', size: 1}]}));
    for (const stage of [both.vertexShader, both.fragmentShader]) {
      assert.equal(stage.split('varying float surfaceAttribute_depth;').length, 2);
    }
  });

  it('hands a file\'s own attribute to both stages by name, its size stated, and refuses a mesh that lacks it', () => {
    const built = program(DEPTH);
    assert.match(built.vertexShader, /attribute float _depth;\nvarying float surfaceAttribute_depth;/);
    assert.ok(at(built.vertexShader, '#include <begin_vertex>\nsurfaceAttribute_depth = _depth;') > 0);
    assert.match(built.fragmentShader, /varying float surfaceAttribute_depth;/);
    assert.throws(() => kind({attributes: [{name: '_depth', size: 5}]}), /K.attributes\[0\].size is one of 1, 2, 3, 4/);
    assert.throws(() => kind({attributes: ['uv', {name: 'uv', size: 2}]}), /K.attributes lists uv twice/);
    assert.throws(() => kind({attributes: [{name: '__depth', size: 1}]}), /which is not a GLSL name/);
    assert.doesNotThrow(() => modelSurfaceDrawable(DEPTH));
    const {asset, body} = kindFile(), surfaces = createModelActorSurfaces(asset, {actor: 'a', path: 'a.glb'},
      {materials: createModelSurfaceMaterials({kinds: modelSurfaceKinds([DEPTH]), changes: () => [],
        shared: createModelStageSharedValues(), read: async () => new ArrayBuffer(0),
        textures: {acquire: () => new THREE.Texture(), release: () => undefined}}), kinds: modelSurfaceKinds([DEPTH]),
      compile: () => undefined});
    const sets = modelSurfaceSets({s: {[RENDERERS.body]: {kind: 'test-form', values: {_Color: {color: [1, 1, 1, 1]},
      _Reach: {float: 0}}}, [RENDERERS.eyes]: {kind: 'file'}, [RENDERERS.line]: {kind: 'file'}}});
    const where = `Actor a, renderer ${RENDERERS.body}, kind test-form`;
    assert.throws(() => surfaces.prepare({from: 'set', set: 's'}, sets), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === TEXT.attribute(where, '_depth'));
    body.geometry.setAttribute('_depth', new THREE.Float32BufferAttribute(new Float32Array(48), 2));
    assert.throws(() => surfaces.prepare({from: 'set', set: 's'}, sets), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === TEXT.size(where, '_depth', 1, 2));
  });

  it('draws a renderer whose kind moves vertices whatever the view, and gives three its culling back', async () => {
    const {asset, body} = kindFile(), kinds = modelSurfaceKinds([SWAY]);
    const materials = createModelSurfaceMaterials({kinds, shared: createModelStageSharedValues(), changes: () => [],
      read: async () => new TextEncoder().encode(SWAY_PROGRAM).buffer, textures: {acquire: () => new THREE.Texture(),
        release: () => undefined}});
    const sets = modelSurfaceSets({s: {[RENDERERS.body]: {kind: 'test-form', values: {_Color: {color: [1, 1, 1, 1]},
      _Reach: {float: 0.2}}}, [RENDERERS.eyes]: {kind: 'file'}, [RENDERERS.line]: {kind: 'file'}}});
    await Promise.all(materials.load([sets.s[RENDERERS.body] as never]).pending);
    const surfaces = createModelActorSurfaces(asset, {actor: 'a', path: 'a.glb'}, {materials, kinds,
      compile: () => undefined});
    surfaces.prepare({from: 'set', set: 's'}, sets)();
    assert.equal(body.frustumCulled, false);
    surfaces.prepare({from: 'file'}, sets)();
    assert.equal(body.frustumCulled, true);
  });
});
