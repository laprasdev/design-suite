import type * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {modelFileRenderers, type ModelRenderer} from './renderers.ts';
import {bindModelRuntimeMaterials} from './runtimeMaterialBinding.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';

/** What an actor draws, whatever its source: its scene, its clips, its renderers by id and, while an asset states a
 * runtime profile (until step 5e removes that route), what binds the engine's values through it, called when the
 * actor is built. */
export interface ModelDrawn {
  readonly scene: THREE.Group;
  readonly clips: readonly THREE.AnimationClip[];
  readonly renderers: () => ReadonlyMap<string, ModelRenderer>;
  readonly runtimeMaterials?: () => ReturnType<typeof bindModelRuntimeMaterials>;
}

/** What a loaded model file draws. Its renderers are read from the loader's associations when first needed. `actor`
 * and `path` name the file in a refusal. */
export function modelFileDrawn(asset: GLTF, file: {readonly actor: string; readonly path: string},
  profile: ModelRuntimeMaterialProfile | undefined): ModelDrawn {
  let ids: ReadonlyMap<string, ModelRenderer> | undefined;
  return {scene: asset.scene, clips: asset.animations,
    renderers: () => ids ??= modelFileRenderers(asset, file.actor, file.path),
    ...(profile && {runtimeMaterials: () => bindModelRuntimeMaterials(asset, profile)})};
}
