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
});

export function extendModelMaterial<T extends THREE.Material>(material: T, changes: readonly ModelShaderChange[]): T {
  const key = changes.map(change => change.key).join(' ');
  material.onBeforeCompile = shader => {
    for (const change of changes) change.apply(shader);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

/** Whether a material compiles three's own program, unchanged by anyone. */
export const modelMaterialUnchanged = (material: THREE.Material) =>
  material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;

/** One anchor of a shader's source replaced; a source without it fails, naming the change and the anchor. */
export function replaceModelShader(source: string, anchor: string, replacement: string, change: string) {
  if (!source.includes(anchor)) throw new Error(MODEL_SHADING_TEXT.anchor(change, anchor));
  return source.replace(anchor, replacement);
}
