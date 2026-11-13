import {ModelStageRefusal} from './refusal.ts';
export type ModelStageMaterialMode = 'lit' | 'clay' | 'color' | 'emission';
export const MODEL_PREVIEW_MATERIAL_TEXT = Object.freeze({
  label: 'Surface', lit: 'Lit', clay: 'Clay', color: 'Color', emission: 'Emission',
  noEmission: 'No emission', unavailable: 'Material inspection unavailable',
});
export const MODEL_PREVIEW_MATERIAL_OPTIONS = Object.freeze([
  {value: 'lit', label: MODEL_PREVIEW_MATERIAL_TEXT.lit},
  {value: 'clay', label: MODEL_PREVIEW_MATERIAL_TEXT.clay},
  {value: 'color', label: MODEL_PREVIEW_MATERIAL_TEXT.color},
  {value: 'emission', label: MODEL_PREVIEW_MATERIAL_TEXT.emission},
] satisfies {value: ModelStageMaterialMode; label: string}[]);
export const MODEL_PREVIEW_MATERIAL_SETTINGS = Object.freeze({clayColor: 0xbcbcbc, roughness: 1, metalness: 0});
export function modelStageMaterialMode(value: unknown): ModelStageMaterialMode {
  const option = MODEL_PREVIEW_MATERIAL_OPTIONS.find(item => item.value === value);
  if (!option) throw new ModelStageRefusal('Unknown material inspection mode.');
  return option.value;
}
