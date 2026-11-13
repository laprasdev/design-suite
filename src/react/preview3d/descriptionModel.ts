import {modelStageDisplay} from './model.ts';
import type {ModelStageCamera, ModelStageDisplay} from './model.ts';
import {MODEL_ACTOR_ANIMATION, modelStageActorSet, modelStageFocus, type ModelStageActorSet} from './actorModel.ts';
import {modelEnvironment, type ModelEnvironment} from './environment.ts';
import {modelPreviewCamera} from './presentation.ts';
import {modelStageLighting, type ModelStageLighting} from './lightingModel.ts';
import {modelStageMaterialMode, type ModelStageMaterialMode} from './materialModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelStageSize, type ModelStageSize} from './sizeModel.ts';

/** The whole host-side state of a stage: one declared description, applied whole or refused. */
export interface ModelStageDescription {
  readonly actors: ModelStageActorSet;
  /** The static scenery, or null for none. */
  readonly environment: ModelEnvironment | null;
  /** A held camera pose, or null to fit the focused actor. */
  readonly camera: ModelStageCamera | null;
  readonly lighting: ModelStageLighting;
  readonly display: ModelStageDisplay;
  readonly materialMode: ModelStageMaterialMode;
  readonly size: ModelStageSize;
}
export const MODEL_STAGE_DESCRIPTION_PARTS = Object.freeze(
  ['actors', 'environment', 'camera', 'lighting', 'display', 'materialMode', 'size'] as const);
export type ModelStageDescriptionPart = typeof MODEL_STAGE_DESCRIPTION_PARTS[number];
export const MODEL_STAGE_DESCRIPTION_REFUSAL = Object.freeze({
  description: `A stage description requires ${MODEL_STAGE_DESCRIPTION_PARTS.join(', ')}.`,
});
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Every part is checked before any is used; null is the explicit "none" of the environment and "fit" of the camera.
export function modelStageDescription(value: unknown): ModelStageDescription {
  if (!object(value) || MODEL_STAGE_DESCRIPTION_PARTS.some(part => !(part in value))) {
    throw new ModelStageRefusal(MODEL_STAGE_DESCRIPTION_REFUSAL.description);
  }
  return Object.freeze({
    actors: modelStageActorSet(value.actors),
    environment: value.environment === null ? null : modelEnvironment(value.environment),
    camera: value.camera === null ? null : modelPreviewCamera(value.camera),
    lighting: modelStageLighting(value.lighting), display: modelStageDisplay(value.display),
    materialMode: modelStageMaterialMode(value.materialMode), size: modelStageSize(value.size),
  });
}

/** The parts a description changes against the one applied; every part, when none is applied yet. */
export function modelStageDescriptionChanges(applied: ModelStageDescription | undefined,
  next: ModelStageDescription): ReadonlySet<ModelStageDescriptionPart> {
  return new Set(MODEL_STAGE_DESCRIPTION_PARTS.filter(part =>
    !applied || JSON.stringify(applied[part]) !== JSON.stringify(next[part])));
}

/** Whether the camera's fit must be taken again: the first description, or a new focus, asset, clip, display or
 * size. */
export function modelStageRefit(applied: ModelStageDescription | undefined, next: ModelStageDescription) {
  if (!applied) return true;
  const framed = (value: ModelStageDescription) => {
    const {id, asset, animation} = modelStageFocus(value.actors);
    const clip = animation.kind === MODEL_ACTOR_ANIMATION.rest ? null : animation.name;
    return JSON.stringify([id, asset, clip, value.display, value.size]);
  };
  return framed(applied) !== framed(next);
}
