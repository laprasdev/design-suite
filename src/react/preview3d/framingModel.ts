import {modelPreviewCamera} from './presentation.ts';
import {modelFlag, modelShape} from './recordModel.ts';
import type {ModelVector} from './placementModel.ts';

export const MODEL_STAGE_FRAMING = Object.freeze({focus: 'focus', all: 'all', pose: 'pose'} as const);
/**
 * What the camera shows: a fit of the focused actor, a fit of every declared actor, or a pose the host holds. Whether
 * the person may orbit away from it is the description's own `orbit`.
 */
export type ModelStageFraming =
  | {readonly kind: typeof MODEL_STAGE_FRAMING.focus}
  | {readonly kind: typeof MODEL_STAGE_FRAMING.all}
  | {readonly kind: typeof MODEL_STAGE_FRAMING.pose; readonly position: ModelVector; readonly target: ModelVector};
// The fields each framing states, and nothing else.
const FIELDS = Object.freeze({focus: ['kind'], all: ['kind'], pose: ['kind', 'position', 'target']});

export function modelStageFraming(value: unknown): ModelStageFraming {
  const {shape: kind, record} = modelShape(value, 'kind', FIELDS, 'The framing');
  if (kind !== MODEL_STAGE_FRAMING.pose) return Object.freeze({kind});
  return Object.freeze({kind, ...modelPreviewCamera(record)});
}

/** Whether the person may orbit away from the framing, stated as true or false. */
export const modelStageOrbit = (value: unknown) => modelFlag(value, 'The stage description.orbit');
