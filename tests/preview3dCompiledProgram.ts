import * as THREE from 'three';
import type {ModelShader} from '../src/react/preview3d/shading.ts';

// A material's program as three would hand it over for a material with a base colour map, an occlusion map, a normal
// map and an emissive map, fogged, under a tone curve; the stage's changes compiled into it.
const MAPS = Object.freeze({map: true, aoMap: true, normalMap: true, normalMapTangentSpace: true, emissiveMap: true,
  roughnessMap: true, clearcoat: true, fog: true, toneMapping: THREE.ACESFilmicToneMapping});
export function compiled(material: THREE.Material, lib: 'standard' | 'physical' | 'basic' | 'points' = 'standard') {
  const shader = {...THREE.ShaderLib[lib], ...MAPS, uniforms: {}} as unknown as ModelShader;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}
