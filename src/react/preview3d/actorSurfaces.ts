import * as THREE from 'three';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {modelFileRenderers, modelSurfaceSetCovers, type ModelRenderer} from './renderers.ts';
import {MODEL_ACTOR_SURFACES, type ModelActorSurfaces, type ModelSurfaceRecord, type ModelSurfaceSet}
  from './surfaceModel.ts';
import type {ModelMaterialOutput} from './surfaceOutputModel.ts';
import {MODEL_SURFACE_PARAMETER, type ModelSurfaceKind} from './surfaceKindModel.ts';
import type {ModelSurfaceMaterial, ModelSurfaceMaterials} from './surfaceMaterials.ts';
import {MODEL_SURFACE_GLSL} from './surfaceProgram.ts';
import {writeModelSurfaceColor} from './color.ts';
import {createModelMaterialInspection} from './materials.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelStageCommit} from './commit.ts';

export interface ModelActorSurfacesContext {
  readonly materials: Pick<ModelSurfaceMaterials, 'material' | 'use' | 'unuse' | 'made'>;
  readonly kinds: ReadonlyMap<string, ModelSurfaceKind>;
  /** Compiles what drawing an object needs as the next frame draws it; a program that cannot be built throws why. */
  readonly compile: (object: THREE.Object3D) => void;
}
export const MODEL_ACTOR_SURFACES_TEXT = Object.freeze({
  mesh: (where: string) => `${where}: a kind draws a mesh, and this renderer draws lines or points.`,
  attribute: (where: string, name: string) => `${where}: the kind reads the vertex attribute ${name}, which the ` +
    'mesh does not have.',
  program: (where: string, why: string) => `${where}: the kind's web program cannot be drawn: ${why}`,
});
const SLOT = 4;
/** A renderer a kind draws, with the values it shows: the record's, or the engine's where this tick states one. */
interface Drawn {readonly record: string; readonly surface: ModelSurfaceMaterial; readonly effective: Float32Array;
  changed: boolean}
const NOTHING_BEFORE_RENDER = THREE.Object3D.prototype.onBeforeRender;

// What draws one actor's renderers: its file's own materials throughout, or its set's entries, each the file's own
// material or a kind's shared material. The one writer of the renderers' materials for its surfaces. Everything that
// can refuse (the set's coverage, a kind's mesh and attributes, its program) is checked while preparing; a commit only
// swaps. Engine values are per renderer: each drawn renderer has its own copy of its record's values, and just before
// it is drawn hands that copy to the shared material when the material holds another's or the copy changed.
export function createModelActorSurfaces(asset: GLTF, file: {readonly actor: string; readonly path: string},
  context: ModelActorSurfacesContext) {
  const {actor} = file;
  // Each mesh's own material, as the file and the stage's changes made it at build.
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  asset.scene.traverse(node => {if (node instanceof THREE.Mesh) originals.set(node, node.material);});
  // The renderers by id, read from the loader's associations the first time a set or a frame's values need them.
  let ids: ReadonlyMap<string, ModelRenderer> | undefined;
  const renderers = () => ids ??= modelFileRenderers(asset, actor, file.path);
  let drawn = new Map<THREE.Mesh, Drawn>();
  const draw = (node: THREE.Mesh, held: Drawn) => {
    const {material} = held.surface, uniform = material.uniforms[MODEL_SURFACE_GLSL.values];
    node.material = material;
    node.onBeforeRender = () => {
      if (uniform.value === held.effective && !held.changed) return;
      uniform.value = held.effective;
      material.uniformsNeedUpdate = true;
      held.changed = false;
    };
  };
  const restore = (node: THREE.Mesh) => {
    node.material = originals.get(node)!;
    node.onBeforeRender = NOTHING_BEFORE_RENDER;
  };
  const prepareRecord = (id: string, node: ModelRenderer, record: ModelSurfaceRecord): Drawn => {
    const kind = context.kinds.get(record.kind)!, where = `Actor ${actor}, renderer ${id}, kind ${kind.id}`;
    if (!(node instanceof THREE.Mesh)) throw new ModelStageRefusal(MODEL_ACTOR_SURFACES_TEXT.mesh(where));
    const lacking = kind.attributes.find(name => !(name in node.geometry.attributes));
    if (lacking) throw new ModelStageRefusal(MODEL_ACTOR_SURFACES_TEXT.attribute(where, lacking));
    const surface = context.materials.material(record), shown = node.material;
    // Compiled on this very mesh (its skinning, morphs and attributes are part of the program), then given back: the
    // mesh draws the kind only when the commit installs it.
    node.material = surface.material;
    try {
      context.compile(node);
    } catch (error) {
      throw new ModelStageRefusal(MODEL_ACTOR_SURFACES_TEXT.program(where,
        error instanceof Error ? error.message : String(error)), {cause: error});
    } finally {
      node.material = shown;
    }
    return {record: JSON.stringify(record), surface, effective: Float32Array.from(surface.declared), changed: true};
  };
  // What a mesh is drawn with by the actor's surfaces: a kind's material where a record draws it, else its file's own.
  const shown = (node: THREE.Mesh) => {
    const held = drawn.get(node);
    return held ? [held.surface.material] : [originals.get(node)!].flat();
  };
  return {
    /** The file's renderers by id, as a surface set names them. */
    renderers,
    /** What the materials the actor draws with allow: the Surface modes, and how many emit. */
    inspection: createModelMaterialInspection(() => [...originals.keys()].flatMap(shown), context.materials.made),
    /** The actor's surfaces as described: a set covers the file's renderers exactly, and every renderer whose record
     * changed has its kind's material ready, compiled on the renderer; the commit swaps the changed ones only. */
    prepare(surfaces: ModelActorSurfaces, sets: Readonly<Record<string, ModelSurfaceSet>>): ModelStageCommit {
      const next = new Map<THREE.Mesh, Drawn>();
      if (surfaces.from === MODEL_ACTOR_SURFACES.set) {
        const set = sets[surfaces.set];
        modelSurfaceSetCovers(actor, surfaces.set, set, renderers());
        for (const [id, entry] of Object.entries(set)) {
          if (!('values' in entry)) continue;
          const node = renderers().get(id)!, held = node instanceof THREE.Mesh ? drawn.get(node) : undefined;
          const ready = held?.record === JSON.stringify(entry) ? held : prepareRecord(id, node, entry);
          next.set(node as THREE.Mesh, ready);
        }
      }
      return () => {
        for (const [node, held] of drawn) {
          if (next.get(node) === held) continue;
          context.materials.unuse(held.surface);
          restore(node);
        }
        for (const [node, held] of next) {
          if (drawn.get(node) === held) continue;
          context.materials.use(held.surface);
          draw(node, held);
        }
        drawn = next;
      };
    },
    /** A frame's values and visibility for this actor, already checked against what its renderers take: every drawn
     * renderer shows its record's values except where the frame states one; returns the renderers the frame hides. */
    prepareValues(outputs: readonly ModelMaterialOutput[]): () => ReadonlySet<THREE.Object3D> {
      const named = outputs.map(output => ({output, node: renderers().get(output.rendererId)!}));
      return () => {
        for (const held of drawn.values()) {
          held.effective.set(held.surface.declared);
          held.changed = true;
        }
        const hidden = new Set<THREE.Object3D>();
        for (const {output, node} of named) {
          if (!output.visible) hidden.add(node);
          // A renderer drawn with its file's own material takes visibility only (the frame check refuses a value).
          const held = node instanceof THREE.Mesh ? drawn.get(node) : undefined;
          if (!held) continue;
          for (const [name, value] of Object.entries(output.colors)) {
            const {index, parameter} = held.surface.slots.get(name)!;
            if (parameter.type !== MODEL_SURFACE_PARAMETER.color) continue;
            writeModelSurfaceColor(held.effective, index * SLOT, value, parameter.space);
          }
          for (const [name, value] of Object.entries(output.floats)) {
            held.effective[held.surface.slots.get(name)!.index * SLOT] = value;
          }
        }
        return hidden;
      };
    },
    /** The file's own materials go back on every renderer before the model is freed; kinds' materials are shared. */
    dispose() {
      for (const [node, held] of drawn) {context.materials.unuse(held.surface); restore(node);}
      drawn = new Map();
    },
  };
}
export type ModelActorSurfaceBinding = ReturnType<typeof createModelActorSurfaces>;
