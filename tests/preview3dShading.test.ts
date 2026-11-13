import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {extendModelMaterial, modelMaterialUnchanged, replaceModelShader, type ModelShader}
  from '../src/react/preview3d/shading.ts';

const shader = (fragmentShader: string) => ({fragmentShader, vertexShader: '', uniforms: {}}) as unknown as ModelShader;

describe('the stage\'s changes to a material\'s program', () => {
  it('composes every change in order into one hook and one program key', () => {
    const material = extendModelMaterial(new THREE.MeshStandardMaterial(), [
      {key: 'first', apply: value => {value.fragmentShader += ' one';}},
      {key: 'second', apply: value => {value.fragmentShader += ' two';}},
    ]);
    const compiled = shader('source');
    material.onBeforeCompile(compiled, {} as THREE.WebGLRenderer);
    assert.equal(compiled.fragmentShader, 'source one two');
    assert.equal(material.customProgramCacheKey(), 'first second');
    assert.equal(modelMaterialUnchanged(material), false);
    assert.equal(modelMaterialUnchanged(new THREE.MeshStandardMaterial()), true);
  });

  it('replaces an anchor once, and fails naming the change and the anchor when the source has none', () => {
    assert.equal(replaceModelShader('a #x b #x', '#x', '#y', 'test'), 'a #y b #x');
    assert.throws(() => replaceModelShader('source', '#include <fog_fragment>', '', 'fog'),
      /The fog change needs #include <fog_fragment> in the material's shader/);
  });
});
