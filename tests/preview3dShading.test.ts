import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {extendModelMaterial, extendModelMaterials, modelMaterialChanges, modelMaterialOwned, modelShaderUniforms,
  type ModelShader} from '../src/react/preview3d/shading.ts';

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
    assert.equal(modelMaterialOwned(material), true);
    assert.deepEqual(modelMaterialChanges(material).map(({key}) => key), ['first', 'second']);
    assert.deepEqual(modelMaterialChanges(new THREE.MeshStandardMaterial()), []);
  });

  it('refuses to extend, or to read the changes of, a program someone else changed', () => {
    const foreign = new THREE.MeshStandardMaterial({name: 'loader'});
    foreign.onBeforeCompile = () => undefined;
    assert.equal(modelMaterialOwned(foreign), false);
    assert.throws(() => modelMaterialChanges(foreign), /The material loader compiles a program the stage did not make/);
    assert.throws(() => extendModelMaterials(new THREE.Mesh(new THREE.BoxGeometry(), foreign), []), /loader/);
  });

  it('extends every material under an object once, each shared material once', () => {
    const shared = new THREE.MeshStandardMaterial(), root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), [shared,
      new THREE.MeshBasicMaterial()]));
    extendModelMaterials(root, [{key: 'fog', apply: () => undefined}]);
    root.traverse(node => {
      if (node instanceof THREE.Mesh) for (const material of [node.material].flat()) {
        assert.deepEqual(modelMaterialChanges(material).map(({key}) => key), ['fog']);
      }
    });
  });

  it('replaces one of three\'s chunks once, and fails naming the change by its program key and the chunk', () => {
    const replacing = (key: string, chunk: string) => extendModelMaterial(new THREE.MeshBasicMaterial(),
      [{key, apply: (value, replace) => {value.fragmentShader = replace(value.fragmentShader, chunk, '#y');}}]);
    const compiled = shader('a #include <x> b #include <x>');
    replacing('test', 'x').onBeforeCompile(compiled, {} as THREE.WebGLRenderer);
    assert.equal(compiled.fragmentShader, 'a #y b #include <x>');
    assert.throws(() => replacing('model-stage-fog', 'fog_fragment').onBeforeCompile(shader('source'),
      {} as THREE.WebGLRenderer), /The model-stage-fog change needs #include <fog_fragment> in the material's shader/);
    assert.equal(modelShaderUniforms({far: 'vec3', on: 'bool'}), 'uniform vec3 far;\nuniform bool on;');
  });
});
