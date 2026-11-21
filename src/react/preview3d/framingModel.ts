import {modelPreviewCamera, type ModelPreviewCamera} from './presentation.ts';
import {modelFlag, modelOption, modelRecord, modelRecordStating, modelStates} from './recordModel.ts';
import {isRecord} from '../../valueChecks.ts';

export const MODEL_STAGE_FRAMING = Object.freeze({focus: 'focus', all: 'all', pose: 'pose'} as const);
/**
 * What the camera shows: a fit of the focused actor, a fit of every declared actor, or a pose the host holds. Whether
 * the person may orbit away from it is the description's own `orbit`.
 */
export type ModelStageFraming =
  | {readonly kind: typeof MODEL_STAGE_FRAMING.focus}
  | {readonly kind: typeof MODEL_STAGE_FRAMING.all}
  | ({readonly kind: typeof MODEL_STAGE_FRAMING.pose} & ModelPreviewCamera);
// The fields each framing states, and nothing else; a pose optionally states its vertical field of view.
const WHERE = 'The framing';
const FIT_FIELDS = Object.freeze(['kind']);
const POSE_FIELDS = Object.freeze({stated: ['kind', 'position', 'target'], whenStated: ['fieldOfView']});

export function modelStageFraming(value: unknown): ModelStageFraming {
  const kind = modelOption(isRecord(value) && modelStates(value, 'kind') ? value.kind : undefined,
    MODEL_STAGE_FRAMING, `${WHERE}.kind`);
  if (kind !== MODEL_STAGE_FRAMING.pose) {
    modelRecord(value, FIT_FIELDS, WHERE);
    return Object.freeze({kind});
  }
  return Object.freeze({kind, ...modelPreviewCamera(modelRecordStating(value, POSE_FIELDS, WHERE))});
}

/** Whether the person may orbit away from the framing, stated as true or false. */
export const modelStageOrbit = (value: unknown) => modelFlag(value, 'The stage description.orbit');
