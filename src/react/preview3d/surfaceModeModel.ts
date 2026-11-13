import {modelOption} from './recordModel.ts';

/** The stage's Surface modes: Lit draws the look; the others inspect one term of every surface (materials.ts). */
export const MODEL_STAGE_SURFACE_MODE = Object.freeze(
  {lit: 'lit', clay: 'clay', color: 'color', emission: 'emission'} as const);
export type ModelStageSurfaceMode = typeof MODEL_STAGE_SURFACE_MODE[keyof typeof MODEL_STAGE_SURFACE_MODE];
const MODE = MODEL_STAGE_SURFACE_MODE;
export const MODEL_PREVIEW_SURFACE_TEXT = Object.freeze({
  label: 'Surface', lit: 'Lit', clay: 'Clay', color: 'Color', emission: 'Emission',
  noEmission: 'No emission', unavailable: 'Material inspection unavailable',
});
export const MODEL_PREVIEW_SURFACE_OPTIONS = Object.freeze([
  {value: MODE.lit, label: MODEL_PREVIEW_SURFACE_TEXT.lit},
  {value: MODE.clay, label: MODEL_PREVIEW_SURFACE_TEXT.clay},
  {value: MODE.color, label: MODEL_PREVIEW_SURFACE_TEXT.color},
  {value: MODE.emission, label: MODEL_PREVIEW_SURFACE_TEXT.emission},
] satisfies {value: ModelStageSurfaceMode; label: string}[]);
export const MODEL_PREVIEW_SURFACE_SETTINGS = Object.freeze({clayColor: 0xbcbcbc, roughness: 1, metalness: 0});
/** A description's Surface mode, refused by its name otherwise, listing the modes. */
export const modelStageSurfaceMode = (value: unknown): ModelStageSurfaceMode =>
  modelOption(value, MODE, 'The stage description.surfaceMode');
