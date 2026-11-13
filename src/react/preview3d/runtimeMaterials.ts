import * as THREE from 'three';

import {MODEL_RUNTIME_MATERIAL, modelMaterialOutput} from './runtimeMaterialModel.ts';
import type {ModelMaterialOutput} from './runtimeMaterialModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {extendModelMaterial, modelMaterialChanges, modelMaterialOwned, replaceModelShader, type ModelShaderChange}
  from './shading.ts';
export {MODEL_RUNTIME_MATERIAL} from './runtimeMaterialModel.ts';
export type {ModelMaterialOutput} from './runtimeMaterialModel.ts';
export interface ModelMaterialBinding {
  readonly rendererId: string;
  readonly slot: number;
  readonly mesh: THREE.Mesh;
}
const EMISSION_FRAGMENT = '#include <emissivemap_fragment>';
const EMISSION_UNIFORM = 'modelRuntimeTintedEmission';
const key = (id: string, slot: number) => JSON.stringify([id, slot]);
function tintedMaterial(original: THREE.MeshStandardMaterial, enabled: {value: boolean}) {
  const tint: ModelShaderChange = {key: MODEL_RUNTIME_MATERIAL.profile, apply: shader => {
    shader.uniforms[EMISSION_UNIFORM] = enabled;
    shader.fragmentShader = `uniform bool ${EMISSION_UNIFORM};\n` + replaceModelShader(shader.fragmentShader,
      EMISSION_FRAGMENT, `${EMISSION_FRAGMENT}\nif (${EMISSION_UNIFORM}) totalEmissiveRadiance *= diffuseColor.rgb;`,
      MODEL_RUNTIME_MATERIAL.profile);
  }};
  // The copy compiles what the original does, the stage's fog included, and then tints its emission.
  return extendModelMaterial(original.clone(), [...modelMaterialChanges(original), tint]);
}
function color(target: THREE.Color, baseline: THREE.Color, value?: readonly number[]) {
  if (value) target.setRGB(value[0], value[1], value[2], THREE.SRGBColorSpace);
  else target.copy(baseline);
}

// Explicit glTF binding profile: E = emissionMap * linear(emissionColor) * strength * tintedBaseColor.
// This is the source emission branch with absent mask=white, noise blend=0 and night boost=1;
// it does not claim the source toon lighting, noise or damage shader has been ported.
export function createModelRuntimeMaterials(bindings: readonly ModelMaterialBinding[]) {
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const slots = new Map<string, {binding: ModelMaterialBinding; original: THREE.MeshStandardMaterial;
    material: THREE.MeshStandardMaterial; enabled: {value: boolean}}>();
  let disposed = false;
  let revision = 0;
  try {
    for (const binding of bindings) {
      const id = key(binding.rendererId, binding.slot);
      if (!binding.rendererId || !Number.isSafeInteger(binding.slot) || binding.slot < 0 || slots.has(id)) {
        throw new Error('Runtime material bindings must have unique renderer/slot identities.');
      }
      if (!(binding.mesh instanceof THREE.Mesh)) throw new Error('Runtime renderer binding must be a mesh.');
      for (const entry of slots.values()) if (entry.binding.mesh === binding.mesh &&
        entry.binding.slot === binding.slot) throw new Error('A material slot cannot have two renderer identities.');
      const original = Array.isArray(binding.mesh.material) ? binding.mesh.material[binding.slot] :
        binding.slot === 0 ? binding.mesh.material : undefined;
      if (!(original instanceof THREE.MeshStandardMaterial) || !modelMaterialOwned(original)) {
        throw new Error('Runtime material binding requires an unmodified standard material.');
      }
      originals.set(binding.mesh, binding.mesh.material);
      const enabled = {value: false};
      slots.set(id, {binding: {...binding}, original, material: tintedMaterial(original, enabled), enabled});
    }
  } catch (error) {
    for (const entry of slots.values()) entry.material.dispose();
    throw error;
  }
  // Visibility is the actor's to write: restore and commit hand back the meshes the outputs want hidden.
  const restore = (): ReadonlySet<THREE.Mesh> => {
    for (const [mesh, material] of originals) mesh.material = material;
    return new Set();
  };
  const live = () => {if (disposed) throw new Error('Runtime material binding has been disposed.');};
  return {
    prepare(values: unknown) {
      live();
      if (!Array.isArray(values)) throw new ModelStageRefusal('Runtime materials must be an array.');
      const updates = new Map<string, ModelMaterialOutput>();
      const visibility = new Map<THREE.Mesh, boolean>();
      for (const value of values) {
        const next = modelMaterialOutput(value), id = key(next.rendererId, next.slot), entry = slots.get(id);
        if (!entry || updates.has(id)) throw new ModelStageRefusal('Unknown or repeated runtime renderer/slot.');
        if (visibility.has(entry.binding.mesh) && visibility.get(entry.binding.mesh) !== next.visible) {
          throw new ModelStageRefusal('Slots of one renderer must agree on visibility.');
        }
        visibility.set(entry.binding.mesh, next.visible);
        updates.set(id, next);
      }
      const preparedAt = revision;
      return (): ReadonlySet<THREE.Mesh> => {
        live();
        if (preparedAt !== revision) throw new ModelStageRefusal('Runtime material preparation is stale.');
        restore();
        for (const [id, update] of updates) {
          const {binding, material, original, enabled} = slots.get(id)!;
          if (!Object.keys(update.colors).length && !Object.keys(update.floats).length) continue;
          color(material.color, original.color, update.colors[MODEL_RUNTIME_MATERIAL.color]);
          color(material.emissive, original.emissive, update.colors[MODEL_RUNTIME_MATERIAL.emissionColor]);
          material.emissiveIntensity = update.floats[MODEL_RUNTIME_MATERIAL.emissionStrength] ??
            original.emissiveIntensity;
          enabled.value = MODEL_RUNTIME_MATERIAL.emissionColor in update.colors ||
            MODEL_RUNTIME_MATERIAL.emissionStrength in update.floats;
          if (Array.isArray(binding.mesh.material)) {
            const installed = binding.mesh.material.slice();
            installed[binding.slot] = material;
            binding.mesh.material = installed;
          } else binding.mesh.material = material;
        }
        revision++;
        return new Set([...visibility].flatMap(([mesh, visible]) => visible ? [] : [mesh]));
      };
    },
    reset() {live(); const hidden = restore(); revision++; return hidden;},
    dispose() {
      if (disposed) return;
      restore();
      for (const entry of slots.values()) entry.material.dispose();
      slots.clear();
      disposed = true;
      revision++;
    },
  };
}
