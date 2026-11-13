import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {ModelStageRefusal} from './refusal.ts';
import {modelStates} from './recordModel.ts';
import {modelRendererId, type ModelSurfaceSet} from './surfaceModel.ts';

// What a model draws: its renderers, each a mesh, a line or points, as three draws a glTF primitive. The one predicate
// and the one traversal every owner reads what is drawn under a root by (the stage's changes to programs, the Surface
// modes' inspection, the aids' lighting, the rig, disposal), and a loaded file's renderers by their one id
// (surfaceModel.ts), read from the loader's own associations: what a surface set must name exactly.
export const MODEL_RENDERER_TEXT = Object.freeze({
  missing: (actor: string, set: string, ids: readonly string[]) =>
    `Actor ${actor}: surface set ${set} leaves out the file's renderers ${ids.join(', ')}.`,
  extra: (actor: string, set: string, ids: readonly string[]) =>
    `Actor ${actor}: surface set ${set} names renderers the file does not have: ${ids.join(', ')}.`,
  unassociated: (actor: string, path: string, name: string) =>
    `Actor ${actor}: ${path} draws ${name || '(unnamed)'}, which the loader gave no glTF primitive.`,
});
export type ModelRenderer = THREE.Mesh | THREE.Line | THREE.Points;
/** Whether a node draws: a mesh, a line or points. */
export const modelIsRenderer = (node: THREE.Object3D): node is ModelRenderer =>
  node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points;
/** The materials a renderer draws with, as a list whether it has one or several. */
export const modelRendererMaterials = (node: ModelRenderer): readonly THREE.Material[] => [node.material].flat();

/** Every renderer under a root, with what it draws with: each material once, in the order first met. */
export function modelDrawnMaterials(root: THREE.Object3D): ReadonlyMap<THREE.Material, ModelRenderer> {
  const materials = new Map<THREE.Material, ModelRenderer>();
  root.traverse(node => {
    if (!modelIsRenderer(node)) return;
    for (const material of modelRendererMaterials(node)) if (!materials.has(material)) materials.set(material, node);
  });
  return materials;
}

/** The glTF node an object belongs to: its own, or its nearest ancestor's, by the loader's associations. */
export function modelNodeIndex(asset: Pick<GLTF, 'scene' | 'parser'>, object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node && node !== asset.scene; node = node.parent) {
    const index = asset.parser.associations.get(node)?.nodes;
    if (index !== undefined) return index;
  }
  return undefined;
}

/** Every renderer a loaded file draws, by its id: one per glTF primitive, as the loader makes them. `actor` and `path`
 * name the file in a refusal. */
export function modelFileRenderers(asset: Pick<GLTF, 'scene' | 'parser'>, actor: string,
  path: string): ReadonlyMap<string, ModelRenderer> {
  const renderers = new Map<string, ModelRenderer>();
  asset.scene.traverse(node => {
    if (!modelIsRenderer(node)) return;
    // three's loader records each primitive's index beside its mesh's (GLTFLoader.js), beyond its declared type.
    const association = asset.parser.associations.get(node), index = modelNodeIndex(asset, node);
    const primitive = association && 'primitives' in association ? association.primitives : undefined;
    if (index === undefined || typeof primitive !== 'number') {
      throw new ModelStageRefusal(MODEL_RENDERER_TEXT.unassociated(actor, path, node.name));
    }
    renderers.set(modelRendererId(index, primitive), node);
  });
  return renderers;
}

/** A set names exactly the file's renderers: one it leaves out and one the file lacks are each refused by name. */
export function modelSurfaceSetCovers(actor: string, name: string, set: ModelSurfaceSet,
  renderers: ReadonlyMap<string, ModelRenderer>) {
  const missing = [...renderers.keys()].filter(id => !modelStates(set, id));
  if (missing.length) throw new ModelStageRefusal(MODEL_RENDERER_TEXT.missing(actor, name, missing));
  const extra = Object.keys(set).filter(id => !renderers.has(id));
  if (extra.length) throw new ModelStageRefusal(MODEL_RENDERER_TEXT.extra(actor, name, extra));
}
