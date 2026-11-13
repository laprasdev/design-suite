import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {createModelSurfaceProgram, MODEL_SURFACE_PROGRAM_TEXT, modelSurfaceDrawable}
  from '../src/react/preview3d/surfaceProgram.ts';
import {modelSurfaceKind} from '../src/react/preview3d/surfaceKindModel.ts';
import {createModelStageSharedValues} from '../src/react/preview3d/sharedValues.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {PULSE, PULSE_PROGRAM} from './preview3dKindFixture.ts';

// What a kind reads beyond its parameters (step E1): the shading normal and the view direction, its position in the
// model's own space, and the look's light by shared names. The toon test kind reads all of them.
export const TOON_PROGRAM = readFileSync(new URL('./preview3dToonKind.glsl', import.meta.url), 'utf8');
const kind = (change: object) => modelSurfaceKind({...PULSE, id: 'test-reads', ...change}, 'K');
const shared = createModelStageSharedValues().declarations;
const built = (change: object, program = PULSE_PROGRAM) => createModelSurfaceProgram(kind(change), program, shared);
const at = (source: string, text: string) => {
  const index = source.indexOf(text);
  assert.ok(index >= 0, text);
  return index;
};
const ASSIGN = ['kindNormal = inverseTransformDirection( normal, viewMatrix );', 'kindViewDirection = ' +
  'inverseTransformDirection( isOrthographic ? vec3( 0.0, 0.0, 1.0 ) : normalize( vViewPosition ), viewMatrix );'];

describe('what a kind reads beyond its parameters', () => {
  it('reads the shading normal and the view direction in world space, written just before its surface runs', () => {
    const {fragmentShader: source, vertexShader} = built({attributes: ['uv', 'normal']});
    assert.ok(at(source, 'uniform vec3 stageShadow;') < at(source, 'vec3 kindNormal;\nvec3 kindViewDirection;'));
    assert.ok(at(source, 'vec3 kindViewDirection;') < at(source, PULSE_PROGRAM), 'declared ahead of the program');
    assert.ok(at(source, '#include <normal_fragment_maps>') < at(source, ASSIGN[0]), 'three\'s normal, flipped');
    assert.ok(at(source, ASSIGN[0]) < at(source, ASSIGN[1]));
    assert.ok(at(source, ASSIGN[1]) < at(source, 'kindSurface( diffuseColor, totalEmissiveRadiance );'));
    assert.equal(vertexShader, THREE.ShaderLib.standard.vertexShader, 'three\'s standard stage hands both on');
  });

  it('gives an unlit kind three\'s own normal, computed where the basic program computes none', () => {
    const {fragmentShader: source, vertexShader: vertex} = built({light: 'unlit', attributes: ['normal']});
    assert.ok(at(vertex, '#include <normal_pars_vertex>\nvarying vec3 vViewPosition;') < at(vertex, 'void main()'));
    const computed = '#include <project_vertex>\n#if ! defined ( USE_ENVMAP ) && ! defined ( USE_SKINNING )\n' +
      '#include <beginnormal_vertex>\n#include <morphnormal_vertex>\n#include <defaultnormal_vertex>\n#endif\n' +
      '#include <normal_vertex>\nvViewPosition = - mvPosition.xyz;';
    assert.ok(at(vertex, computed) > at(vertex, '#include <skinning_vertex>'), 'after skinning, projected');
    assert.ok(at(source, 'varying vec3 vViewPosition;') < at(source, 'void main()'));
    assert.ok(at(source, '#include <specularmap_fragment>') < at(source, '#include <normal_fragment_begin>'));
    assert.ok(at(source, '#include <normal_fragment_begin>') < at(source, ASSIGN[0]));
    assert.ok(at(source, ASSIGN[1]) < at(source, 'kindSurface( diffuseColor, kindEmissive );'));
  });

  it('reads its position in the model\'s own space, after skinning and its own displacement', () => {
    const still = built({attributes: ['position']});
    for (const stage of [still.vertexShader, still.fragmentShader]) {
      assert.equal(stage.split('varying vec3 kindObjectPosition;').length, 2, 'declared once in each stage');
    }
    assert.ok(at(still.vertexShader, '#include <project_vertex>\nkindObjectPosition = transformed;') >
      at(still.vertexShader, '#include <skinning_vertex>'));
    const moving = built({attributes: ['position'], parameters: {...PULSE.parameters, _Reach: {type: 'float'}},
      displacement: {reach: '_Reach'}}, `${PULSE_PROGRAM}\nvec3 kindDisplacement( vec3 world ) { return world; }`);
    assert.ok(at(moving.vertexShader, 'kindDisplacement( kindWorld )') <
      at(moving.vertexShader, 'kindObjectPosition = transformed;'), 'the displaced position');
    assert.equal(moving.vertexShader.split('varying vec3 kindObjectPosition;').length, 2);
  });

  it('adds nothing a kind does not declare: its programs are what they were', () => {
    const plain = built({});
    assert.equal(plain.vertexShader, THREE.ShaderLib.standard.vertexShader);
    assert.ok(!plain.fragmentShader.includes('kindNormal') && !plain.fragmentShader.includes('kindObjectPosition'));
    assert.equal(built({light: 'unlit'}).vertexShader, THREE.ShaderLib.basic.vertexShader);
    assert.throws(() => modelSurfaceDrawable(kind({attributes: ['tangent']})), (error: unknown) =>
      error instanceof ModelStageRefusal && error.message === MODEL_SURFACE_PROGRAM_TEXT.attribute('test-reads',
        'tangent'));
  });

  it('declares, ahead of the toon test kind, every stage name it reads: normal, view, the look\'s light', () => {
    const {fragmentShader: source} = built({light: 'unlit', attributes: ['normal']}, TOON_PROGRAM);
    for (const name of ['kindNormal', 'kindViewDirection', 'stageKeyDirection', 'stageKeyColor', 'stageAmbientSky',
      'stageAmbientGround', 'stageShadow']) {
      assert.ok(TOON_PROGRAM.includes(name), name);
      assert.ok(at(source, ` ${name};`) < at(source, TOON_PROGRAM), name);
    }
  });
});
