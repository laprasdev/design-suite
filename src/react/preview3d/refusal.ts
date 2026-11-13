// The stage's one model of failure. A refusal is a request the stage did not apply: the stage is exactly as it was,
// and the message says what was refused. Any other error that escapes means the stage is unusable.
export class ModelStageRefusal extends Error {
  override name = 'ModelStageRefusal';
}
export const MODEL_STAGE_FAILURE = Object.freeze({refused: 'refused', unusable: 'unusable'} as const);
export type ModelStageFailureKind = typeof MODEL_STAGE_FAILURE[keyof typeof MODEL_STAGE_FAILURE];
export interface ModelStageFailure {
  readonly kind: ModelStageFailureKind;
  readonly message: string;
}

// Decided by the failure's kind: a refusal keeps a stage that exists; with no stage to keep, nothing can be shown.
export function modelStageFailure(error: unknown, stageExists: boolean): ModelStageFailure {
  const kind = error instanceof ModelStageRefusal && stageExists ? MODEL_STAGE_FAILURE.refused :
    MODEL_STAGE_FAILURE.unusable;
  return Object.freeze({kind, message: error instanceof Error ? error.message : String(error)});
}
