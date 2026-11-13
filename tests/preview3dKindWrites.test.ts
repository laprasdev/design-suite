import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelSurfaceProgram} from '../src/react/preview3d/surfaceProgram.ts';
import {MODEL_SURFACE_KIND_REFUSAL, modelSurfaceKind, modelSurfaceKinds}
  from '../src/react/preview3d/surfaceKindModel.ts';
import {createModelSurfaceMaterials} from '../src/react/preview3d/surfaceMaterials.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {PULSE, PULSE_PROGRAM, record} from './preview3dKindFixture.ts';

// What a kind may write and use beyond its colour (step E2): its normal from a normal map, its light response, a
// cut-out threshold the stage sharpens once, shared GLSL its repository owns, a texture's tiling.
const CUTOFF = {...PULSE.parameters, _Cutoff: {type: 'float'}};
const kind = (change: object) => modelSurfaceKind({...PULSE, id: 'test-writes', ...change}, 'K');
const shared = createModelStageSharedValues().declarations;
const built = (change: object, program = PULSE_PROGRAM) => createModelSurfaceProgram(kind(change), program, shared);
const RESPONSE = `${PULSE_PROGRAM}\nvoid kindResponse() { kindRoughness = 0.3; }`;
const at = (source: string, text: string) => {
  const index = source.indexOf(text);
  assert.ok(index >= 0, text);
  return index;
};
const refused = (run: () => unknown, pattern: RegExp | string) => assert.throws(run, (error: unknown) =>
  error instanceof ModelStageRefusal && (typeof pattern === 'string' ? error.message === pattern :
    pattern.test(error.message)), String(pattern));
const CALL = 'kindSurface( diffuseColor, totalEmissiveRadiance );';

describe('what a kind may write beyond its colour', () => {
  it('writes a lit kind\'s occlusion, roughness and metalness, which arrive as the stage always drew them', () => {
    const {fragmentShader: source} = built({}, RESPONSE), {uniforms} = THREE.ShaderLib.standard;
    assert.deepEqual([uniforms.roughness.value, uniforms.metalness.value], [1, 0], 'three\'s, for a kind: 1 and 0');
    assert.ok(at(source, 'float kindOcclusion;\nfloat kindRoughness;\nfloat kindMetalness;') <
      at(source, RESPONSE), 'declared ahead of the program');
    const plain = built({}).fragmentShader;
    assert.ok(!plain.includes('kindOcclusion') && !plain.includes('roughnessFactor = kindRoughness'),
      'a program that names none of them has none of them: the program it had');
    assert.ok(at(source, '#include <metalnessmap_fragment>') < at(source, 'kindOcclusion = 1.0;\n' +
      'kindRoughness = roughnessFactor;\nkindMetalness = metalnessFactor;'));
    assert.ok(at(source, 'kindMetalness = metalnessFactor;') < at(source, CALL));
    const taken = 'roughnessFactor = kindRoughness;\nmetalnessFactor = kindMetalness;';
    const lighting = '#include <lights_physical_fragment>';
    assert.ok(at(source, CALL) < at(source, taken) && at(source, taken) < at(source, lighting));
    assert.ok(at(source, '#include <lights_fragment_end>') <
      at(source, '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= kindOcclusion;'), 'scales the ambient');
    assert.ok(!built({light: 'unlit'}, RESPONSE).fragmentShader.includes('float kindRoughness;'),
      'an unlit kind has no light response');
  });

  it('writes a lit kind\'s normal from a normal map, through three\'s own frame, into three\'s lighting', () => {
    const {fragmentShader: source} = built({attributes: ['uv', 'normal']});
    assert.ok(at(source, 'vec3 kindViewNormal;\nvec3 kindNormalFromTangentSpace( vec3 tangentNormal, vec2 uv ) {') <
      at(source, PULSE_PROGRAM));
    for (const line of ['vec3 q0 = dFdx( - vViewPosition ), q1 = dFdy( - vViewPosition );',
      'vec3 tangent = q1perp * st0.x + q0perp * st1.x, bitangent = q1perp * st0.y + q0perp * st1.y;',
      '#ifdef DOUBLE_SIDED', 'frame[ 0 ] *= face;', 'frame[ 1 ] *= face;',
      'return inverseTransformDirection( frame * tangentNormal, viewMatrix );']) assert.ok(source.includes(line), line);
    assert.ok(at(source, 'kindViewNormal = normal;') < at(source, CALL));
    const back = 'normal = normalize( ( viewMatrix * vec4( kindNormal, 0.0 ) ).xyz );';
    const lighting = '#include <lights_physical_fragment>';
    assert.ok(at(source, CALL) < at(source, back) && at(source, back) < at(source, lighting));
    const unlit = built({light: 'unlit', attributes: ['normal']}).fragmentShader;
    assert.ok(unlit.includes('kindNormalFromTangentSpace') && !unlit.includes(back), 'an unlit kind lights itself');
  });

  it('cuts out at a declared threshold, its alpha sharpened once by the stage for alpha to coverage', () => {
    const named = built({parameters: CUTOFF, coverage: {cutout: '_Cutoff'}});
    assert.equal(named.fragmentShader.split('float kindCoverage( float alpha, float threshold ) {').length, 2);
    for (const line of ['float sharpened = saturate( ( alpha - threshold - 0.5 * edge ) / max( edge, 0.0001 ) + ' +
      '1.0 );', 'return threshold <= 0.0 ? 1.0 : sharpened;']) assert.ok(named.fragmentShader.includes(line), line);
    const sharpened = 'diffuseColor.a = kindCoverage( diffuseColor.a, surfaceParameter_Cutoff() );';
    assert.ok(at(named.fragmentShader, CALL) < at(named.fragmentShader, sharpened));
    assert.ok(built({coverage: {cutout: 1}}).fragmentShader.includes('kindCoverage( diffuseColor.a, 1.0 );'));
    assert.ok(built({coverage: {cutout: 0.25}}).fragmentShader.includes('kindCoverage( diffuseColor.a, 0.25 );'));
    const material = named.make({});
    assert.deepEqual([material.alphaToCoverage, material.transparent, material.depthWrite], [true, false, true]);
    assert.ok(!built({coverage: 'cutout'}).fragmentShader.includes('kindCoverage'), 'a plain cut-out: as written');
    refused(() => kind({coverage: {cutout: '_Color'}}),
      MODEL_SURFACE_KIND_REFUSAL.float('K.coverage.cutout', '_Color'));
    refused(() => kind({coverage: {cutout: 1.5}}), /K.coverage.cutout must be a finite number from 0 to 1/);
    refused(() => kind({coverage: 'clip'}), MODEL_SURFACE_KIND_REFUSAL.coverage('K.coverage'));
    refused(() => kind({coverage: {cutout: 0.5, soft: 1}}), /K.coverage does not state soft/);
  });

  it('includes the shared GLSL its repository owns, by path and SHA-256, ahead of its own program in order',
    async () => {
    const SHARED = {path: '/shared.glsl', sha256: 'c'.repeat(64)}, MORE = {path: '/more.glsl', sha256: 'd'.repeat(64)};
    assert.deepEqual(kind({}).webProgram.includes, [], 'left out: it includes none');
    const including = {...PULSE, webProgram: {...PULSE.webProgram, includes: [SHARED, MORE]}};
    assert.deepEqual(modelSurfaceKind(including, 'K').webProgram.includes, [SHARED, MORE]);
    refused(() => kind({webProgram: {...PULSE.webProgram, includes: [SHARED, SHARED]}}),
      MODEL_SURFACE_KIND_REFUSAL.twice('K.webProgram.includes', '/shared.glsl'));
    refused(() => kind({webProgram: {...PULSE.webProgram, includes: [{path: '/x.glsl'}]}}),
      /K.webProgram.includes\[0\] omits sha256/);
    refused(() => kind({webProgram: {...PULSE.webProgram, includes: undefined}}), /includes is stated with no value/);
    const texts: Record<string, string> = {'/pulse.glsl': PULSE_PROGRAM,
      '/shared.glsl': 'float sharedOne() { return 1.0; }',
      '/more.glsl': 'float sharedTwo() { return sharedOne() * 2.0; }'};
    const reads: string[] = [];
    const materials = createModelSurfaceMaterials({kinds: modelSurfaceKinds([including]),
      shared: createModelStageSharedValues(), changes: () => [], read: async path => {
        reads.push(path);
        return new TextEncoder().encode(texts[path]).buffer;
      }, textures: {acquire: () => new THREE.Texture(), release: () => undefined}});
    await Promise.all(materials.load([record() as never]).pending);
    assert.deepEqual(reads.sort(), ['/more.glsl', '/pulse.glsl', '/shared.glsl'], 'each read in the staged load');
    const source = materials.material(record() as never).material.fragmentShader;
    assert.ok(at(source, texts['/shared.glsl']) < at(source, texts['/more.glsl']));
    assert.ok(at(source, texts['/more.glsl']) < at(source, PULSE_PROGRAM));
  });

  it('reads a texture\'s tiling and offset as Unity\'s _ST holds them, and samples at a uv as given', () => {
    const {fragmentShader: source} = built({});
    assert.ok(source.includes('vec4 surfaceTiling_Mask() { return surfaceValues[ 6 ]; }'));
    assert.ok(source.includes('vec4 surfaceSample_Mask( vec2 uv ) { return texture2D( surfaceTexture_Mask, uv ); }'));
  });
});
