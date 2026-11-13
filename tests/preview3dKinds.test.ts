import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelSurfaceProgram, MODEL_SURFACE_PROGRAM_TEXT, modelSurfaceDrawable}
  from '../src/react/preview3d/surfaceProgram.ts';
import {modelSurfaceKind} from '../src/react/preview3d/surfaceKindModel.ts';
import {MODEL_STAGE_SHARED, MODEL_STAGE_SHARED_UNIFORM} from '../src/react/preview3d/sharedValues.ts';
import {MODEL_SURFACE_OUTPUT_REFUSAL as OUTPUT, modelSurfaceOutputs, modelSurfaceTakes}
  from '../src/react/preview3d/surfaceOutputModel.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {kindMaterials, kinds, MASK, PULSE, PULSE_PROGRAM, record, RENDERERS, sets} from './preview3dKindFixture.ts';
import {declaration, entity} from './preview3dActorFixture.ts';
import {createModelFrameInbox} from '../src/react/preview3d/frameInbox.ts';

const refused = (run: () => unknown, pattern: RegExp | string) => assert.throws(run, (error: unknown) =>
  error instanceof ModelStageRefusal && (typeof pattern === 'string' ? error.message === pattern :
    pattern.test(error.message)), String(pattern));
const linear = (value: number) => new THREE.Color().setRGB(value, 0, 0, THREE.SRGBColorSpace).r;
const close = (actual: ArrayLike<number>, expected: readonly number[]) =>
  assert.deepEqual(Array.from(actual, value => Math.round(value * 1e6) / 1e6),
    expected.map(value => Math.round(value * 1e6) / 1e6));

describe('a surface kind\'s web program', () => {
  it('is placed in three\'s own standard program: what it reads declared, its surface called once', () => {
    const kind = modelSurfaceKind(PULSE, 'K');
    const {fragmentShader, make} = createModelSurfaceProgram(kind, PULSE_PROGRAM, '<shared>');
    const surface = 'kindSurface( diffuseColor, totalEmissiveRadiance );\n#include <emissivemap_fragment>';
    assert.equal(fragmentShader.split(surface).length, 2, 'called once, just before three\'s emission chunk');
    for (const line of ['uniform vec4 surfaceValues[ 7 ];', 'uniform sampler2D surfaceTexture_Mask;', '<shared>',
      'vec4 surfaceParameter_Color() { return surfaceValues[ 0 ]; }',
      'vec4 surfaceParameter_Glow() { return surfaceValues[ 1 ]; }',
      'float surfaceParameter_Pulse() { return surfaceValues[ 2 ].x; }',
      'vec2 surfaceParameter_Offset() { return surfaceValues[ 4 ].xy; }',
      'bool surfaceParameter_On() { return surfaceValues[ 5 ].x > 0.5; }',
      'vec4 surfaceParameter_Mask( vec2 uv ) { return texture2D( surfaceTexture_Mask, uv * surfaceValues[ 6 ].xy + ' +
        'surfaceValues[ 6 ].zw ); }', PULSE_PROGRAM]) assert.ok(fragmentShader.includes(line), line);
    assert.ok(fragmentShader.indexOf(PULSE_PROGRAM) < fragmentShader.indexOf('void main()'));
    const material = make({});
    assert.deepEqual([material.vertexShader, material.lights, material.fog, material.side, material.defines],
      [THREE.ShaderLib.standard.vertexShader, true, true, THREE.FrontSide, {STANDARD: '', USE_UV: ''}]);
  });

  it('takes its render state from the declaration: side, coverage and the attributes it reads', () => {
    const made = (change: object) => createModelSurfaceProgram(modelSurfaceKind({...PULSE, ...change}, 'K'), '', '')
      .make({});
    const cutout = made({coverage: 'cutout', side: 'double', attributes: ['color']});
    assert.deepEqual([cutout.alphaToCoverage, cutout.transparent, cutout.depthWrite, cutout.side, cutout.vertexColors,
      cutout.defines], [true, false, true, THREE.DoubleSide, true, {STANDARD: ''}]);
    const blended = made({coverage: 'blended', side: 'back', fog: false});
    assert.deepEqual([blended.alphaToCoverage, blended.transparent, blended.depthWrite, blended.side, blended.fog],
      [false, true, false, THREE.BackSide, false]);
  });

  it('refuses, by name, a kind this stage cannot draw yet, and a parameter GLSL cannot name', () => {
    const drawable = (change: object) => () => modelSurfaceDrawable(modelSurfaceKind({...PULSE, ...change}, 'K'));
    refused(drawable({light: 'unlit'}), MODEL_SURFACE_PROGRAM_TEXT.light('test-pulse', 'unlit'));
    refused(drawable({displacement: {reach: '_Pulse'}}), MODEL_SURFACE_PROGRAM_TEXT.displacement('test-pulse'));
    refused(drawable({attributes: ['uv1']}), MODEL_SURFACE_PROGRAM_TEXT.attribute('test-pulse', 'uv1'));
    for (const name of ['__Color', '_Main__Tex', 'Main Tex', '_Color.r', '1st', '']) {
      refused(() => modelSurfaceKind({...PULSE, parameters: {[name]: {type: 'float'}}}, 'K'),
        new RegExp(`K.parameters names ${name.replace('.', '\\.')}, which is not a GLSL name`));
    }
    assert.doesNotThrow(() => modelSurfaceKind({...PULSE, parameters: {Brightness_Rim: {type: 'float'}}, inert: {}},
      'K'));
  });
});

describe('the stage\'s kind materials', () => {
  it('builds one material per record, shared, its values written once by the one colour rule', async () => {
    const {materials, shared, acquired} = await kindMaterials();
    const [first] = Object.values(sets().tinted);
    const surface = materials.material(first as never);
    assert.equal(materials.material(sets().tinted[RENDERERS.body] as never), surface, 'the same record: one material');
    assert.notEqual(materials.material(record([0, 0, 1, 1]) as never), surface, 'another record: another');
    close(surface.declared, [linear(1), linear(0.5), 0, 1, 4, 2, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0.5, -1, 0, 0,
      1, 0, 0, 0, 2, 3, 0.25, 0.5]);
    const {uniforms} = surface.material;
    assert.equal(uniforms.surfaceValues.value, surface.declared);
    for (const name of Object.values(MODEL_STAGE_SHARED_UNIFORM)) {
      assert.equal(uniforms[name], shared.uniforms[name], `${name} is the stage's own object, never a copy`);
    }
    // A kind reads them under their own names.
    for (const name of Object.values(MODEL_STAGE_SHARED)) assert.ok(shared.declarations.includes(name), name);
    assert.deepEqual(acquired, [MASK, MASK], 'each record\'s material acquires its texture once');
    assert.ok(uniforms.surfaceTexture_Mask.value instanceof THREE.Texture);
    assert.equal(surface.material.customProgramCacheKey(), 'model-stage-fog model-surface-mode:lit');
    assert.ok(materials.made(surface.material));
    assert.equal(materials.made(new THREE.MeshStandardMaterial()), false);
  });

  it('frees, once a description is applied, every material no actor draws with, and its textures', async () => {
    const {materials, released} = await kindMaterials();
    const used = materials.material(record() as never), unused = materials.material(record([0, 0, 1, 1]) as never);
    let freed = 0;
    unused.material.addEventListener('dispose', () => freed++);
    materials.use(used);
    materials.sweep();
    assert.deepEqual([freed, released.length], [1, 1]);
    assert.equal(materials.material(record() as never), used, 'a used one stays');
    materials.unuse(used);
    materials.sweep();
    assert.notEqual(materials.material(record() as never), used, 'built again once it was freed');
  });
});

describe('the engine\'s values for an actor\'s renderers', () => {
  const takes = () => modelSurfaceTakes({from: 'set', set: 'tinted'}, sets(), kinds());
  const output = (change: object = {}) => ({rendererId: RENDERERS.body, slot: 0, visible: true,
    colors: {_Color: [0.5, 0.5, 0.5, 1]}, floats: {_Pulse: 3}, ...change});
  const where = `Entity e, renderer ${RENDERERS.body}`;
  it('takes a value only on a parameter its renderer\'s kind declares, by the record\'s rule', () => {
    assert.equal(modelSurfaceOutputs([output()], takes(), 'Entity e').length, 1);
    const outputs = (change: object) => () => modelSurfaceOutputs([output(change)], takes(), 'Entity e');
    refused(outputs({floats: {_Missing: 1}}), OUTPUT.undeclared(where, '_Missing', 'float', 'test-pulse'));
    refused(outputs({colors: {_Pulse: [1, 1, 1, 1]}}), OUTPUT.undeclared(where, '_Pulse', 'color', 'test-pulse'));
    refused(outputs({colors: {_Color: [2, 0, 0, 1]}}), /_Color is not HDR: each channel is from 0 to 1/);
    refused(outputs({floats: {_Rim: 1}}), /_Rim is drawn only at 0/);
    refused(outputs({slot: 1}), OUTPUT.slot(where, 1));
    refused(outputs({rendererId: RENDERERS.eyes}), OUTPUT.file(`Entity e, renderer ${RENDERERS.eyes}`, '_Color'));
    refused(outputs({rendererId: 'gltf-node:9/primitive:0'}), /names renderer gltf-node:9\/primitive:0; the actor's/);
    refused(() => modelSurfaceOutputs([output(), output()], takes(), 'Entity e'), OUTPUT.twice('Entity e',
      RENDERERS.body));
    assert.doesNotThrow(() => modelSurfaceOutputs([output({rendererId: RENDERERS.eyes, colors: {}, floats: {},
      visible: false})], takes(), 'Entity e'), 'a file-drawn renderer takes visibility');
    refused(() => modelSurfaceOutputs([output()], modelSurfaceTakes({from: 'file'}, sets(), kinds()), 'Entity e'),
      /the actor's surfaces list no renderer/);
  });

  it('is checked the same way by the view\'s frame inbox, against the kinds the stage is given', () => {
    const inbox = createModelFrameInbox(), declared = {surfaceSets: sets(), actors: {focus: 'e',
      actors: [declaration('e', 'otter', {surfaces: {from: 'set', set: 'tinted'}})]}};
    const frame = (change: object) => ({simulationTimeSeconds: 0, entities: [{...entity('e'),
      materials: [output(change)]}]});
    assert.equal(inbox.receive(frame({}), declared, [PULSE as never]), 'pending');
    assert.equal(inbox.receive(frame({floats: {_Missing: 1}}), declared, [PULSE as never]), 'error');
    assert.equal((inbox.failure as Error).message, OUTPUT.undeclared(where, '_Missing', 'float', 'test-pulse'));
  });
});
