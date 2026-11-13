import * as THREE from 'three';

// The stage's one owner of changes to a material's program. Every change the stage makes to what a three.js material
// compiles goes through `extendModelMaterial`, which composes the changes in order into one hook and one program key,
// so two changes to one material never overwrite each other. A change is placed at three's own chunks, named once
// through `modelShaderChunk`, and its refusals name the change by the key the program cache knows it by.
export type ModelShader = THREE.WebGLProgramParametersWithUniforms;
/** One of three's chunks in a shader's source replaced: `chunk` is its name, as `fog_fragment`. */
export type ModelShaderReplace = (source: string, chunk: string, replacement: string) => string;
/** One change to a material's program: its name in the program's cache key (read at each lookup, so a change whose
 * program depends on a state names that state), and the change itself. */
export interface ModelShaderChange {
  readonly key: string;
  apply(shader: ModelShader, replace: ModelShaderReplace): void;
}
export const MODEL_SHADING_TEXT = Object.freeze({
  anchor: (change: string, anchor: string) => `The ${change} change needs ${anchor} in the material's shader.`,
  foreign: (name: string) => `The material ${name || '(unnamed)'} compiles a program the stage did not make.`,
});
// The changes the stage made to each material it extended, so a copy of one can be given the same.
const extended = new WeakMap<THREE.Material, readonly ModelShaderChange[]>();
const NONE: readonly ModelShaderChange[] = Object.freeze([]);

/** three's include line for one of its chunks: the only form a change places itself by. */
export const modelShaderChunk = (name: string) => `#include <${name}>`;
/** The declarations of a change's uniforms, by name and GLSL type: the one way a change declares what it reads. */
export const modelShaderUniforms = (uniforms: Readonly<Record<string, string>>) =>
  Object.entries(uniforms).map(([name, type]) => `uniform ${type} ${name};`).join('\n');

/** One chunk of a source replaced once, text as written; a source without it fails, naming the change and the chunk. */
export function modelShaderReplace(key: string): ModelShaderReplace {
  return (source, chunk, replacement) => {
    const anchor = modelShaderChunk(chunk);
    if (!source.includes(anchor)) throw new Error(MODEL_SHADING_TEXT.anchor(key, anchor));
    return source.replace(anchor, () => replacement);
  };
}

export function extendModelMaterial<T extends THREE.Material>(material: T, changes: readonly ModelShaderChange[]): T {
  material.onBeforeCompile = shader => {
    for (const change of changes) change.apply(shader, modelShaderReplace(change.key));
  };
  // three asks for the key at every program lookup (with glow, for every material twice a frame), so the joined key
  // is held and rebuilt only when one of its changes names another state; asking allocates nothing.
  const keys = changes.map(change => change.key);
  let key = keys.join(' ');
  material.customProgramCacheKey = () => {
    let moved = false;
    for (let index = 0; index < changes.length; index++) {
      if (changes[index].key === keys[index]) continue;
      keys[index] = changes[index].key;
      moved = true;
    }
    if (moved) key = keys.join(' ');
    return key;
  };
  extended.set(material, Object.freeze([...changes]));
  return material;
}

/** Whether a material compiles three's own program, or one only the stage changed. */
export const modelMaterialOwned = (material: THREE.Material) =>
  material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile || extended.has(material);

/** The stage's changes to a material's program, none for three's own; a program someone else changed fails. */
export function modelMaterialChanges(material: THREE.Material): readonly ModelShaderChange[] {
  if (material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile) return NONE;
  const changes = extended.get(material);
  if (!changes) throw new Error(MODEL_SHADING_TEXT.foreign(material.name));
  return changes;
}

/**
 * Every material under an object, each once, extended with these changes; each must compile three's own program. A
 * model's lines and points are drawn too, so they are extended like its meshes.
 */
export function extendModelMaterials(root: THREE.Object3D, changes: readonly ModelShaderChange[]) {
  const materials = new Set<THREE.Material>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Points)) return;
    for (const material of [node.material].flat()) materials.add(material);
  });
  for (const material of materials) {
    if (modelMaterialChanges(material).length) throw new Error(MODEL_SHADING_TEXT.foreign(material.name));
  }
  for (const material of materials) extendModelMaterial(material, changes);
}
