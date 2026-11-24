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

/** The glTF primitive a renderer draws: its node, the node's mesh and the primitive's place in that mesh. */
export interface ModelRendererPrimitive {readonly node: number; readonly mesh: number; readonly primitive: number}
type ModelLoadedFile = Pick<GLTF, 'scene' | 'parser'>;
/** The object a glTF node loaded as, and the node's index. */
interface ModelLoadedNode {readonly object: THREE.Object3D; readonly index: number}
// The node an object belongs to: the object itself or its nearest ancestor the loader associates with a node.
function loadedNode(asset: ModelLoadedFile, object: THREE.Object3D): ModelLoadedNode | undefined {
  for (let node: THREE.Object3D | null = object; node && node !== asset.scene; node = node.parent) {
    const index = asset.parser.associations.get(node)?.nodes;
    if (index !== undefined) return {object: node, index};
  }
  return undefined;
}
// three's EXT_mesh_gpu_instancing (GLTFLoader.js `GLTFMeshGpuInstancing`) runs only on a node that states a mesh, and
// loads each of that mesh's primitives as an InstancedMesh, in primitive order: the node itself when the mesh has one
// primitive, else the children of the node's group. It associates none of them with a mesh or primitive, so an
// instanced mesh draws the primitive at its place among the node's children (the first when it is the node itself).
function instancedPrimitive(asset: ModelLoadedFile, renderer: THREE.InstancedMesh,
  node: ModelLoadedNode): ModelRendererPrimitive {
  const mesh: unknown = asset.parser.json.nodes[node.index].mesh;
  if (typeof mesh !== 'number') {
    throw new Error(`glTF node ${node.index} loaded an instanced mesh, but the file states no mesh for that node.`);
  }
  const primitive = renderer === node.object ? 0 : node.object.children.indexOf(renderer);
  return {node: node.index, mesh, primitive};
}
/** The primitive a renderer draws, read from the loader's associations, or none when the loader gave it none. Every
 * reader of a renderer's primitive reads it here. */
export function modelRendererPrimitive(asset: ModelLoadedFile, renderer: ModelRenderer):
  ModelRendererPrimitive | undefined {
  const node = loadedNode(asset, renderer);
  if (!node) return undefined;
  // three's loader records each primitive's index beside its mesh's (GLTFLoader.js), beyond its declared type.
  const association = asset.parser.associations.get(renderer);
  const primitive = association && 'primitives' in association ? association.primitives : undefined;
  if (typeof primitive === 'number' && association?.meshes !== undefined) {
    return {node: node.index, mesh: association.meshes, primitive};
  }
  return renderer instanceof THREE.InstancedMesh ? instancedPrimitive(asset, renderer, node) : undefined;
}

/** Every renderer a loaded file draws, by its id: one per glTF primitive, as the loader makes them. `actor` and `path`
 * name the file in a refusal. */
export function modelFileRenderers(asset: ModelLoadedFile, actor: string,
  path: string): ReadonlyMap<string, ModelRenderer> {
  const renderers = new Map<string, ModelRenderer>();
  asset.scene.traverse(node => {
    if (!modelIsRenderer(node)) return;
    const drawn = modelRendererPrimitive(asset, node);
    if (!drawn) throw new ModelStageRefusal(MODEL_RENDERER_TEXT.unassociated(actor, path, node.name));
    renderers.set(modelRendererId(drawn.node, drawn.primitive), node);
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
