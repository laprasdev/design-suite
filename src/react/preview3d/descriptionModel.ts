import {modelStageDisplay} from './model.ts';
import type {ModelStageDisplay} from './model.ts';
import {MODEL_ACTOR_ANIMATION, modelStageActorSet, modelStageFocus, type ModelStageActorSet} from './actorModel.ts';
import {modelEnvironment, type ModelEnvironment} from './environment.ts';
import {MODEL_STAGE_FRAMING, modelStageFraming, modelStageOrbit, type ModelStageFraming} from './framingModel.ts';
import {modelStageLighting, type ModelStageLighting} from './lightingModel.ts';
import {modelStageMaterialMode, type ModelStageMaterialMode} from './materialModel.ts';
import {modelRecord} from './recordModel.ts';
import {MODEL_ACTOR_SURFACES, MODEL_SURFACE_REFUSAL, modelSurfaceSets, type ModelSurfaceSet} from './surfaceModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {modelStageOrigin, modelStageSize, type ModelStageOrigin, type ModelStageSize} from './sizeModel.ts';

/** The whole host-side state of a stage: one declared description, applied whole or refused. */
export interface ModelStageDescription {
  readonly actors: ModelStageActorSet;
  /** The static scenery, or null for none. */
  readonly environment: ModelEnvironment | null;
  readonly framing: ModelStageFraming;
  /** Whether the person may orbit away from the framing; Reset returns to it. */
  readonly orbit: boolean;
  readonly lighting: ModelStageLighting;
  /** The named sets an actor's surfaces may refer to, each keyed by the renderers of the file it is for. */
  readonly surfaceSets: Readonly<Record<string, ModelSurfaceSet>>;
  readonly display: ModelStageDisplay;
  readonly materialMode: ModelStageMaterialMode;
  readonly size: ModelStageSize;
  readonly origin: ModelStageOrigin;
}
export const MODEL_STAGE_DESCRIPTION_PARTS = Object.freeze(
  ['actors', 'environment', 'framing', 'orbit', 'lighting', 'surfaceSets', 'display', 'materialMode', 'size',
    'origin'] as const);
export type ModelStageDescriptionPart = typeof MODEL_STAGE_DESCRIPTION_PARTS[number];

// Every part is checked before any is used, and a part the description does not have is refused by name; null is the
// explicit "none" of the environment.
export function modelStageDescription(input: unknown): ModelStageDescription {
  const value = modelRecord(input, MODEL_STAGE_DESCRIPTION_PARTS, 'The stage description');
  const actors = modelStageActorSet(value.actors), surfaceSets = modelSurfaceSets(value.surfaceSets);
  for (const {id, surfaces} of actors.actors) {
    if (surfaces.kind === MODEL_ACTOR_SURFACES.set && !(surfaces.set in surfaceSets)) {
      throw new ModelStageRefusal(MODEL_SURFACE_REFUSAL.unknownSet(`Actor ${id}.surfaces.set`, surfaces.set,
        Object.keys(surfaceSets)));
    }
  }
  return Object.freeze({
    actors, surfaceSets,
    environment: value.environment === null ? null : modelEnvironment(value.environment),
    framing: modelStageFraming(value.framing), orbit: modelStageOrbit(value.orbit),
    lighting: modelStageLighting(value.lighting), display: modelStageDisplay(value.display),
    materialMode: modelStageMaterialMode(value.materialMode), size: modelStageSize(value.size),
    origin: modelStageOrigin(value.origin),
  });
}

/** The parts a description changes against the one applied; every part, when none is applied yet. */
export function modelStageDescriptionChanges(applied: ModelStageDescription | undefined,
  next: ModelStageDescription): ReadonlySet<ModelStageDescriptionPart> {
  return new Set(MODEL_STAGE_DESCRIPTION_PARTS.filter(part =>
    !applied || JSON.stringify(applied[part]) !== JSON.stringify(next[part])));
}

/** The actors the framing fits: the focused one, every declared one, or none for a held pose. */
export function modelStageFramed(value: ModelStageDescription) {
  if (value.framing.kind === MODEL_STAGE_FRAMING.pose) return [];
  return value.framing.kind === MODEL_STAGE_FRAMING.all ? value.actors.actors : [modelStageFocus(value.actors)];
}

/** Whether the camera's fit must be taken again: the first description, or a change to what the fit measures: the
 * framing, the fitted actors' assets, placements and clips, the display, the size or the origin. */
export function modelStageRefit(applied: ModelStageDescription | undefined, next: ModelStageDescription) {
  if (!applied) return true;
  const framed = (value: ModelStageDescription) => JSON.stringify([value.framing, value.display, value.size,
    value.origin, modelStageFramed(value).map(({id, asset, placement, animation}) =>
      [id, asset, placement, animation.kind === MODEL_ACTOR_ANIMATION.rest ? null : animation.name])]);
  return framed(applied) !== framed(next);
}
