import {modelFlag, modelName, modelOption, modelRecord} from './recordModel.ts';
import {modelSurfaceKinds, type ModelSurfaceKind} from './surfaceKindModel.ts';

/** The stage's clocks: its own, which the page's time moves, or the engine's, which only applied frames move. */
export const MODEL_STAGE_CLOCK = Object.freeze({local: 'local', external: 'external'} as const);
export type ModelStageClock = typeof MODEL_STAGE_CLOCK[keyof typeof MODEL_STAGE_CLOCK];
/**
 * What is fixed when a stage is created, all stated: its clock, which every actor's playback is built for; whether the
 * stage lays its own floor and grid; the surface kinds a description may use (none is a stated empty list); and the
 * host property its review handle is published under.
 */
export interface ModelStageOptions {
  readonly reviewKey: string;
  readonly clock: ModelStageClock;
  readonly floor: boolean;
  readonly grid: boolean;
  readonly kinds: readonly ModelSurfaceKind[];
}
const FIELDS = Object.freeze(['reviewKey', 'clock', 'floor', 'grid', 'kinds']);
const WHERE = 'The stage\'s option record';

/** The stage's options, checked whole: exactly its fields, each by its own rule. */
export function modelStagePolicy(options: ModelStageOptions) {
  const record = modelRecord(options, FIELDS, WHERE);
  modelName(record.reviewKey, `${WHERE}.reviewKey`);
  return Object.freeze({clock: modelOption(record.clock, MODEL_STAGE_CLOCK, `${WHERE}.clock`),
    floor: modelFlag(record.floor, `${WHERE}.floor`), grid: modelFlag(record.grid, `${WHERE}.grid`),
    kinds: modelSurfaceKinds(record.kinds)});
}
export type ModelStagePolicy = ReturnType<typeof modelStagePolicy>;
