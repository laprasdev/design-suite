import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {ModelStageRefusal} from './refusal.ts';
import {modelRendererId, type ModelSurfaceSet} from './surfaceModel.ts';

// A loaded file's renderers, each by its one id (surfaceModel.ts), read from the loader's own associations: what a
// surface set must name exactly.
export const MODEL_RENDERER_TEXT = Object.freeze({
  missing: (actor: string, set: string, ids: readonly string[]) =>
    `Actor ${actor}: surface set ${set} leaves out the file's renderers ${ids.join(', ')}.`,
  extra: (actor: string, set: string, ids: readonly string[]) =>
    `Actor ${actor}: surface set ${set} names renderers the file does not have: ${ids.join(', ')}.`,
  unassociated: (name: string) => `The file draws ${name || '(unnamed)'}, which the loader gave no glTF primitive.`,
});
export type ModelRenderer = THREE.Mesh | THREE.Line | THREE.Points;
const drawn = (node: THREE.Object3D): node is ModelRenderer =>
  node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points;

/** The glTF node an object belongs to: its own, or its nearest ancestor's, by the loader's associations. */
export function modelNodeIndex(asset: Pick<GLTF, 'scene' | 'parser'>, object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node && node !== asset.scene; node = node.parent) {
    const index = asset.parser.associations.get(node)?.nodes;
    if (index !== undefined) return index;
  }
  return undefined;
}

/** Every renderer a loaded file draws, by its id: one per glTF primitive, as the loader makes them. */
export function modelFileRenderers(asset: Pick<GLTF, 'scene' | 'parser'>): ReadonlyMap<string, ModelRenderer> {
  const renderers = new Map<string, ModelRenderer>();
  asset.scene.traverse(node => {
    if (!drawn(node)) return;
    // three's loader records each primitive's index beside its mesh's (GLTFLoader.js), beyond its declared type.
    const association = asset.parser.associations.get(node), index = modelNodeIndex(asset, node);
    const primitive = association && 'primitives' in association ? association.primitives : undefined;
    if (index === undefined || typeof primitive !== 'number') {
      throw new ModelStageRefusal(MODEL_RENDERER_TEXT.unassociated(node.name));
    }
    renderers.set(modelRendererId(index, primitive), node);
  });
  return renderers;
}

/** A set names exactly the file's renderers: one it leaves out and one the file lacks are each refused by name. */
export function modelSurfaceSetCovers(actor: string, name: string, set: ModelSurfaceSet,
  renderers: ReadonlyMap<string, ModelRenderer>) {
  const missing = [...renderers.keys()].filter(id => !(id in set));
  if (missing.length) throw new ModelStageRefusal(MODEL_RENDERER_TEXT.missing(actor, name, missing));
  const extra = Object.keys(set).filter(id => !renderers.has(id));
  if (extra.length) throw new ModelStageRefusal(MODEL_RENDERER_TEXT.extra(actor, name, extra));
}
