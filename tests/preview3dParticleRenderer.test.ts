// The stage's particle renderer (particleRenderer.ts): every batch quarks makes for an emitter takes the stage's fog.
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import * as THREE from 'three';
import {MODEL_RENDER_MODE, MODEL_UNITY_BUILTIN_MESH} from '../src/react/preview3d/emitterModel.ts';
import {MODEL_FOG_CHANGE} from '../src/react/preview3d/fog.ts';
import {MODEL_PARTICLE_FOG_ANCHORS} from '../src/react/preview3d/particleRenderer.ts';
import {applyModelShaderChanges, modelMaterialChanges} from '../src/react/preview3d/shading.ts';
import {withEmitters} from './preview3dEmitterActors.ts';
import {EMITTER_ID, emitterProfile} from './preview3dEmitterCases.ts';

describe('the stage\'s particle batches', () => {
  it('take the stage\'s fog through its program changes, in quarks\' billboard and mesh programs alike', () => {
    const {particles} = withEmitters('a', {[EMITTER_ID]: emitterProfile(),
      spheres: {...emitterProfile(), renderMode: MODEL_RENDER_MODE.mesh, mesh: {guid: MODEL_UNITY_BUILTIN_MESH.guid,
        fileID: MODEL_UNITY_BUILTIN_MESH.meshes[0].fileID}}});
    const {batches} = particles;
    assert.equal(batches.length, 2);
    for (const {material, settings} of batches) {
      assert.ok(material instanceof THREE.ShaderMaterial && material.fog, 'a batch takes no fog');
      const changes = modelMaterialChanges(material);
      assert.deepEqual(changes.map(({key}) => key),
        [`${MODEL_PARTICLE_FOG_ANCHORS}-${settings.renderMode}`, MODEL_FOG_CHANGE]);
      const shader = {vertexShader: material.vertexShader, fragmentShader: material.fragmentShader,
        uniforms: {...material.uniforms}, fog: true};
      applyModelShaderChanges(shader, changes);
      assert.ok(shader.vertexShader.includes('vModelStageFogY') && shader.fragmentShader.includes('modelStageFogNear'));
      assert.ok('fogNear' in shader.uniforms && 'modelStageFogFar' in shader.uniforms);
    }
  });
});

