import * as THREE from 'three';
import {applyModelShaderChanges, modelMaterialChanges, type ModelShader}
  from '../src/react/preview3d/shading.ts';

// One of three's programs as three would hand it over for a material with a base colour map, an occlusion map, a
// normal map and an emissive map, fogged, under a tone curve.
export function program(lib: keyof typeof THREE.ShaderLib) {
  const uniforms: ModelShader['uniforms'] = {};
  return {vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader,
    uniforms, map: true, aoMap: true, normalMap: true, normalMapTangentSpace: true, emissiveMap: true,
    roughnessMap: true, clearcoat: true, fog: true, toneMapping: THREE.ACESFilmicToneMapping};
}

/** A program with the stage's changes to a material compiled into it, in the order the material's hook applies them. */
export function compiled<T extends ModelShader>(material: THREE.Material, shader: T) {
  applyModelShaderChanges(shader, modelMaterialChanges(material));
  return shader;
}
