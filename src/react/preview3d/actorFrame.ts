import type {ModelActor} from './actor.ts';
import {MODEL_ACTOR_REFUSAL} from './actorModel.ts';
import {MODEL_STAGE_COMMIT_TEXT, MODEL_STAGE_UNCHANGED, applyModelStageCommits, type ModelStageCommit}
  from './commit.ts';
import {MODEL_NO_EMITTER_CHANGES} from './emitterFrameModel.ts';
import {checkModelEmitterBudget, createModelEmitterLoad} from './emitterModel.ts';
import {isModelValidatedFrame, type ModelValidatedFrame} from './frameModel.ts';
import type {ModelPreviewEntity} from './presentation.ts';
import {ModelStageRefusal} from './refusal.ts';

// What applying a frame writes into, made once by its stage: the emitter load, the entity the frame names for each
// actor (by the actor's index; none where it names none) and the prepared actors' commits.
export interface ModelFrameSlots {
  readonly emitterLoad: Float64Array;
  readonly entities: (ModelPreviewEntity | undefined)[];
  readonly commits: ModelStageCommit[];
}
export const createModelFrameSlots = (): ModelFrameSlots =>
  Object.freeze({emitterLoad: createModelEmitterLoad(), entities: [], commits: []});

// Prepare every named actor from a validated frame before any commits: a refusal leaves every actor and the camera as
// they were. An actor the frame does not name keeps what it shows. The emitter budget holds for every emitter the stage
// would run once the frame applies, added into the slots' `emitterLoad`; checked only on a frame that changes one,
// since nothing else changes what runs. Allocates nothing: what it prepares is written into the slots.
function frameEntity(entities: readonly ModelPreviewEntity[], id: string) {
  for (let index = 0; index < entities.length; index++) {
    if (entities[index].entityId === id) return entities[index];
  }
  return undefined;
}
function changesEmitters(entities: readonly ModelPreviewEntity[]) {
  for (let index = 0; index < entities.length; index++) {
    if (entities[index].emitters.length) return true;
  }
  return false;
}
export function applyModelFrame(actors: readonly ModelActor[], value: ModelValidatedFrame,
  applyCamera: (coordinates: Float64Array) => void, slots: ModelFrameSlots) {
  if (!isModelValidatedFrame(value)) throw new ModelStageRefusal(MODEL_ACTOR_REFUSAL.unvalidated);
  const {emitterLoad, entities, commits} = slots, changing = changesEmitters(value.entities);
  let named = 0, count = 0;
  emitterLoad.fill(0);
  // The slots keep no actor or entity once the frame applies or refuses.
  try {
    for (let index = 0; index < actors.length; index++) {
      const actor = actors[index], entity = entities[index] = frameEntity(value.entities, actor.id);
      if (entity) named++;
      if (changing) actor.emitters.addLoad(entity ? entity.emitters : MODEL_NO_EMITTER_CHANGES, emitterLoad);
    }
    if (named !== value.entities.length) throw new ModelStageRefusal(MODEL_ACTOR_REFUSAL.scope);
    if (changing) checkModelEmitterBudget(emitterLoad);
    for (let index = 0; index < actors.length; index++) {
      const entity = entities[index];
      if (entity) commits[count++] = actors[index].prepare(entity, value.simulationTimeSeconds);
    }
    applyModelStageCommits(commits, count);
  } finally {
    entities.fill(undefined, 0, actors.length);
    commits.fill(MODEL_STAGE_UNCHANGED, 0, count);
  }
  if (value.cameraCoordinates !== null) {
    try {applyCamera(value.cameraCoordinates);} catch (error) {
      throw new Error(MODEL_STAGE_COMMIT_TEXT.partial, {cause: error});
    }
  }
  return value.simulationTimeSeconds;
}
