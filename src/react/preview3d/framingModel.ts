import {MODEL_PREVIEW_CAMERA_FIELDS, modelPreviewCamera, type ModelPreviewCamera} from './presentation.ts';
import {modelFlag, modelShape, type ModelStatingFields} from './recordModel.ts';

export const MODEL_STAGE_FRAMING = Object.freeze({focus: 'focus', all: 'all', pose: 'pose'} as const);
/**
 * What the camera shows: a fit of the focused actor, a fit of every declared actor, or a pose the host holds. Whether
 * the person may orbit away from it is the description's own `orbit`.
 */
export type ModelStageFraming =
  | {readonly kind: typeof MODEL_STAGE_FRAMING.focus}
  | {readonly kind: typeof MODEL_STAGE_FRAMING.all}
  | ({readonly kind: typeof MODEL_STAGE_FRAMING.pose} & ModelPreviewCamera);
// The fields each framing states, and nothing else; a pose extends a camera's fields with `kind`.
const WHERE = 'The framing';
const FIELDS: Readonly<Record<ModelStageFraming['kind'], ModelStatingFields>> = Object.freeze({
  focus: {stated: ['kind'], whenStated: []},
  all: {stated: ['kind'], whenStated: []},
  pose: {stated: ['kind', ...MODEL_PREVIEW_CAMERA_FIELDS.stated], whenStated: MODEL_PREVIEW_CAMERA_FIELDS.whenStated},
});

export function modelStageFraming(value: unknown): ModelStageFraming {
  const {shape: kind, record} = modelShape(value, 'kind', FIELDS, WHERE);
  return kind === MODEL_STAGE_FRAMING.pose ? Object.freeze({kind, ...modelPreviewCamera(record, WHERE)}) :
    Object.freeze({kind});
}

/** Whether the person may orbit away from the framing, stated as true or false. */
export const modelStageOrbit = (value: unknown) => modelFlag(value, 'The stage description.orbit');
