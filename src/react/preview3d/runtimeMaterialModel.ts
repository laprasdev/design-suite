import {ModelStageRefusal} from './refusal.ts';
import {modelIsDigest, modelIsRecord as object} from './recordModel.ts';
import {modelMaterialOutputShape, type ModelMaterialOutput} from './surfaceOutputModel.ts';
export type {ModelMaterialOutput} from './surfaceOutputModel.ts';
export const MODEL_RUNTIME_MATERIAL = Object.freeze({
  color: '_Color', emissionColor: '_EmissionColor', emissionStrength: '_EmissionStrength',
  profile: 'base-color-tinted-emission', colorSpace: 'srgb', emissionMask: 'white', noiseBlend: 0, nightBoost: 1,
} as const);
export interface ModelRendererBinding {
  readonly rendererId: string;
  readonly nodeIndex: number;
  readonly meshIndex: number;
  readonly primitiveIndex: number;
  readonly slot: number;
}
export interface ModelRuntimeMaterialProfile {
  readonly asset: {readonly id: string; readonly revision: string; readonly sha256: string};
  readonly profile: typeof MODEL_RUNTIME_MATERIAL.profile;
  readonly colorSpace: typeof MODEL_RUNTIME_MATERIAL.colorSpace;
  readonly emissionMask: typeof MODEL_RUNTIME_MATERIAL.emissionMask;
  readonly noiseBlend: typeof MODEL_RUNTIME_MATERIAL.noiseBlend;
  readonly nightBoost: typeof MODEL_RUNTIME_MATERIAL.nightBoost;
  readonly renderers: readonly ModelRendererBinding[];
}
const index = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
export const modelMaterialKey = (id: string, slot: number) => JSON.stringify([id, slot]);

export function modelRuntimeMaterialProfile(value: unknown): ModelRuntimeMaterialProfile {
  if (!object(value) || !Array.isArray(value.renderers) || value.renderers.length === 0) {
    throw new ModelStageRefusal('An explicit runtime material profile and renderer bindings are required.');
  }
  for (const key of ['profile', 'colorSpace', 'emissionMask', 'noiseBlend', 'nightBoost'] as const) {
    if (value[key] !== MODEL_RUNTIME_MATERIAL[key]) throw new ModelStageRefusal(`Unsupported runtime material ${key}.`);
  }
  if (!object(value.asset) || typeof value.asset.id !== 'string' || !value.asset.id ||
    typeof value.asset.revision !== 'string' || !value.asset.revision ||
    !modelIsDigest(value.asset.sha256)) {
    throw new ModelStageRefusal('Runtime materials require an exact asset identity, revision and SHA-256.');
  }
  const asset = Object.freeze({id: value.asset.id, revision: value.asset.revision, sha256: value.asset.sha256});
  const identities = new Set<string>(), locations = new Set<string>();
  const renderers = Array.from(value.renderers, binding => {
    if (!object(binding) || typeof binding.rendererId !== 'string' || !binding.rendererId ||
      !['nodeIndex', 'meshIndex', 'primitiveIndex', 'slot'].every(key => index(binding[key]))) {
      throw new ModelStageRefusal('Runtime renderer bindings require explicit glTF node/mesh/primitive/slot indices.');
    }
    const identity = modelMaterialKey(binding.rendererId, Number(binding.slot));
    const location = JSON.stringify([binding.nodeIndex, binding.meshIndex, binding.primitiveIndex, binding.slot]);
    if (identities.has(identity) || locations.has(location)) {
      throw new ModelStageRefusal('Duplicate runtime renderer binding.');
    }
    identities.add(identity); locations.add(location);
    return Object.freeze({rendererId: binding.rendererId, nodeIndex: Number(binding.nodeIndex),
      meshIndex: Number(binding.meshIndex), primitiveIndex: Number(binding.primitiveIndex),
      slot: Number(binding.slot)});
  });
  const {profile, colorSpace, emissionMask, noiseBlend, nightBoost} = MODEL_RUNTIME_MATERIAL;
  return Object.freeze({asset, profile, colorSpace, emissionMask, noiseBlend, nightBoost,
    renderers: Object.freeze(renderers)});
}

// The profile's names and colour form, over the one shape check (surfaceOutputModel.ts).
export function modelMaterialOutput(value: unknown): ModelMaterialOutput {
  const output = modelMaterialOutputShape(value, 'A runtime material output');
  for (const [name, components] of Object.entries(output.colors)) {
    if (name !== MODEL_RUNTIME_MATERIAL.color && name !== MODEL_RUNTIME_MATERIAL.emissionColor) {
      throw new ModelStageRefusal(`Unsupported runtime color: ${name}`);
    }
    if (components.some(number => number < 0) || components[3] !== 1) {
      throw new ModelStageRefusal('This material binding requires nonnegative sRGB colors with opaque alpha.');
    }
  }
  for (const name of Object.keys(output.floats)) {
    if (name !== MODEL_RUNTIME_MATERIAL.emissionStrength) {
      throw new ModelStageRefusal(`Unsupported or nonfinite runtime material float: ${name}`);
    }
  }
  return output;
}

export function modelMaterialOutputs(values: unknown, profile?: ModelRuntimeMaterialProfile) {
  if (!Array.isArray(values) || (!profile && values.length)) {
    throw new ModelStageRefusal('materials must be an explicitly empty array without a runtime material profile.');
  }
  const bindings = profile ? modelRuntimeMaterialProfile(profile).renderers : [];
  const allowed = new Set(bindings.map(binding => modelMaterialKey(binding.rendererId, binding.slot)));
  const seen = new Set<string>();
  return Object.freeze(Array.from(values, value => {
    const next = modelMaterialOutput(value), key = modelMaterialKey(next.rendererId, next.slot);
    if (!allowed.has(key) || seen.has(key)) throw new ModelStageRefusal('Unknown or repeated runtime renderer/slot.');
    seen.add(key);
    return next;
  }));
}
