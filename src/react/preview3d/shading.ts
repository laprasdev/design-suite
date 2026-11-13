import * as THREE from 'three';

// The stage's one owner of changes to a material's program. Every change the stage makes to what a three.js material
// compiles goes through `extendModelMaterial`, which composes the changes in order into one hook and one program key,
// so two changes to one material never overwrite each other.
export type ModelShader = THREE.WebGLProgramParametersWithUniforms;
/** One change to a material's program: its name in the program's cache key, and the change itself. */
export interface ModelShaderChange {
  readonly key: string;
  apply(shader: ModelShader): void;
}
export const MODEL_SHADING_TEXT = Object.freeze({
  anchor: (change: string, anchor: string) => `The ${change} change needs ${anchor} in the material's shader.`,
  foreign: (name: string) => `The material ${name || '(unnamed)'} compiles a program the stage did not make.`,
});
// The changes the stage made to each material it extended, so a copy of one can be given the same.
const extended = new WeakMap<THREE.Material, readonly ModelShaderChange[]>();
const NONE: readonly ModelShaderChange[] = Object.freeze([]);

export function extendModelMaterial<T extends THREE.Material>(material: T, changes: readonly ModelShaderChange[]): T {
  const key = changes.map(change => change.key).join(' ');
  material.onBeforeCompile = shader => {
    for (const change of changes) change.apply(shader);
  };
  material.customProgramCacheKey = () => key;
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

/** Every material under an object, each once, extended with these changes; each must compile three's own program. */
export function extendModelMaterials(root: THREE.Object3D, changes: readonly ModelShaderChange[]) {
  const materials = new Set<THREE.Material>();
  root.traverse(node => {
    if (node instanceof THREE.Mesh) for (const material of [node.material].flat()) materials.add(material);
  });
  for (const material of materials) {
    if (modelMaterialChanges(material).length) throw new Error(MODEL_SHADING_TEXT.foreign(material.name));
  }
  for (const material of materials) extendModelMaterial(material, changes);
}

/** One anchor of a shader's source replaced; a source without it fails, naming the change and the anchor. */
export function replaceModelShader(source: string, anchor: string, replacement: string, change: string) {
  if (!source.includes(anchor)) throw new Error(MODEL_SHADING_TEXT.anchor(change, anchor));
  return source.replace(anchor, replacement);
}
