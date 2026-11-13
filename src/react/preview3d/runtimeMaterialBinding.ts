import * as THREE from 'three';
import {GLTFLoader, type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {createModelRuntimeMaterials} from './runtimeMaterials.ts';
import {modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';

export async function loadModelRuntimeAsset(path: string, profile: ModelRuntimeMaterialProfile,
  signal: AbortSignal): Promise<GLTF> {
  const accepted = modelRuntimeMaterialProfile(profile);
  const response = await fetch(path, {signal});
  if (!response.ok) throw new Error('The runtime model could not be loaded.');
  const bytes = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== accepted.asset.sha256) throw new Error('The runtime model does not match its verified SHA-256.');
  signal.throwIfAborted();
  const base = new URL('.', new URL(path, document.baseURI)).href;
  return new GLTFLoader().parseAsync(bytes, base);
}

// glTF node ownership comes from loader associations, not labels or traversal positions.
export function bindModelRuntimeMaterials(asset: GLTF, profile: ModelRuntimeMaterialProfile) {
  const accepted = modelRuntimeMaterialProfile(profile);
  const meshes: THREE.Mesh[] = [];
  asset.scene.traverse(node => {if (node instanceof THREE.Mesh) meshes.push(node);});
  const nodeIndex = (mesh: THREE.Mesh) => {
    let node: THREE.Object3D | null = mesh;
    while (node && node !== asset.scene) {
      const index = asset.parser.associations.get(node)?.nodes;
      if (index !== undefined) return index;
      node = node.parent;
    }
    return undefined;
  };
  const bindings = accepted.renderers.map(binding => {
    const matches = meshes.filter(mesh => {
      const association = asset.parser.associations.get(mesh);
      return nodeIndex(mesh) === binding.nodeIndex && association?.meshes === binding.meshIndex &&
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
