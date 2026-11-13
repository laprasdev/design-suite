export type ModelStageLighting = 'light' | 'dark';
export const MODEL_PREVIEW_LIGHTING_TEXT = Object.freeze({label: 'Lighting', light: 'Light', dark: 'Dark'});
export const MODEL_PREVIEW_LIGHTING_OPTIONS = Object.freeze([
  {value: 'light', label: MODEL_PREVIEW_LIGHTING_TEXT.light},
  {value: 'dark', label: MODEL_PREVIEW_LIGHTING_TEXT.dark},
] satisfies {value: ModelStageLighting; label: string}[]);
// Light is the consumer's theme, as the stage has always shown it. Dark is a night stage of its own: a deep backdrop,
// a floor that still reads under less light, both lights cooled and held to one share of their strength, and the unlit
// stage aids (grid, rig, markers) held to another, so a model's emission carries the picture. Exposure is untouched, or
// the glow would dim with the lights.
export const MODEL_STAGE_DARK = Object.freeze({
  backdrop: 0x05080f, floor: 0x262a33, light: 0x99bfff, lightShare: 0.3, aidShare: 0.3,
});
export function modelStageLighting(value: unknown): ModelStageLighting {
  const option = MODEL_PREVIEW_LIGHTING_OPTIONS.find(item => item.value === value);
  if (!option) throw new Error('Unknown stage lighting.');
  return option.value;
}
