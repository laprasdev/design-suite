import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {createModelRuntimeMaterials} from './runtimeMaterials.ts';
import {modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelNodeIndex} from './renderers.ts';
import {readModelFile} from './files.ts';

export async function loadModelRuntimeAsset(path: string, profile: ModelRuntimeMaterialProfile,
  signal: AbortSignal): Promise<GLTF> {
  const accepted = modelRuntimeMaterialProfile(profile);
  const bytes = await readModelFile(path, accepted.asset.sha256, signal);
  const base = new URL('.', new URL(path, document.baseURI)).href;
  return new GLTFLoader().parseAsync(bytes, base);
}

// glTF node ownership comes from loader associations, not labels or traversal positions.
export function bindModelRuntimeMaterials(asset: GLTF, profile: ModelRuntimeMaterialProfile) {
  const accepted = modelRuntimeMaterialProfile(profile);
  const meshes: THREE.Mesh[] = [];
  asset.scene.traverse(node => {if (node instanceof THREE.Mesh) meshes.push(node);});
  const bindings = accepted.renderers.map(binding => {
    const matches = meshes.filter(mesh => {
      const association = asset.parser.associations.get(mesh);
      return modelNodeIndex(asset, mesh) === binding.nodeIndex && association?.meshes === binding.meshIndex &&
        association !== undefined && 'primitives' in association && association.primitives === binding.primitiveIndex;
    });
    if (matches.length !== 1) throw new Error(`Runtime renderer does not resolve uniquely: ${binding.rendererId}`);
    const mesh = matches[0];
    const material = Array.isArray(mesh.material) ? mesh.material[binding.slot] :
      binding.slot === 0 ? mesh.material : undefined;
    if (!(material instanceof THREE.MeshStandardMaterial) || material.emissiveMap !== null) {
      throw new Error('The white emission-mask profile requires a standard material without an emission map.');
    }
    return {...binding, mesh};
  });
  return createModelRuntimeMaterials(bindings);
}
