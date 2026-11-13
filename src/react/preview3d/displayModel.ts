import {modelOption} from './recordModel.ts';

/** What the stage draws of each actor: its model, its rig (an aid), or both. */
export const MODEL_STAGE_DISPLAY = Object.freeze({model: 'model', rig: 'rig', both: 'both'} as const);
export type ModelStageDisplay = typeof MODEL_STAGE_DISPLAY[keyof typeof MODEL_STAGE_DISPLAY];
/** A description's display, refused by its name otherwise, listing the displays. */
export const modelStageDisplay = (value: unknown): ModelStageDisplay =>
  modelOption(value, MODEL_STAGE_DISPLAY, 'The stage description.display');
