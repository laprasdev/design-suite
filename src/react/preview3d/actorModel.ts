import type {ModelRotation, ModelStageAsset, ModelStageTransform, ModelVector} from './model.ts';
import type {ModelPreviewPresentation} from './presentation.ts';
import {modelPresentationRotation, modelPresentationVector, modelPreviewPresentation} from './presentation.ts';
import type {ModelAnimationSample} from './animationLayerModel.ts';
import type {ModelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// Actor ids are the host's. A frame's entities are keyed by actor id and the host owns the mapping from an engine's
// entity ids to them: the stage never learns an engine id as such. Two actors may share one asset, so an actor's id
// is never taken from its asset; the stage's own character is the one case where they coincide (its actor id is
// `character.id`, by the existing API). Declared actors are host data: no engine record creates or removes one.
export interface ModelStageActor {
  readonly id: string;
  readonly asset: ModelStageAsset;
  readonly placement: ModelStageTransform;
  /** An animation in the asset's file, shown at its first frame while the engine decides no animation. */
  readonly heldAnimation?: string;
}
export const MODEL_STAGE_DRIVER = Object.freeze({host: 'host', engine: 'engine'} as const);
export type ModelStageDriver = typeof MODEL_STAGE_DRIVER[keyof typeof MODEL_STAGE_DRIVER];
export interface ModelPreviewEntity extends ModelPreviewPresentation {
  readonly entityId: string;
}
// The stage's own frame, built by the host: not the engine's raw frame, which also holds scenery entities that a
// host draws another way. Every entity names a declared actor, so an unknown id is refused rather than dropped.
export interface ModelPreviewFrame {
  readonly simulationTimeSeconds: number;
  readonly entities: readonly ModelPreviewEntity[];
}
export interface ModelStageActorSnapshot {
  readonly id: string;
  readonly modelId: string;
  readonly driver: ModelStageDriver;
  readonly pose: {readonly position: ModelVector; readonly rotationQuaternion: ModelRotation;
    readonly scale: ModelVector};
  readonly held: string;
  readonly samples: readonly ModelAnimationSample[];
}
export interface ModelFrameActor {
  readonly modelId: string;
  readonly runtimeMaterials?: ModelRuntimeMaterialProfile;
}
export const MODEL_ACTOR_REFUSAL = Object.freeze({
  actors: 'Declared actors must be an array.',
  actor: (index: number) =>
    `Actor ${index} requires an id, an asset with an id, path and attachments, and a placement.`,
  repeated: (id: string) => `Actor ${id} is declared twice.`,
  character: (id: string) => `Actor ${id} repeats the stage's own character id.`,
  held: (id: string) => `Actor ${id}: heldAnimation must name a clip.`,
  frame: 'A frame requires a finite nonnegative simulationTimeSeconds and an entities array.',
  removed: 'This stage removes no actor from an engine frame; removedEntities must be empty.',
  entity: 'Every frame entity requires an entityId.',
  undeclared: (id: string) => `Frame entity ${id} names no declared actor; engine records do not create actors.`,
  twice: (id: string) => `Frame entity ${id} appears twice.`,
});
const refusal = MODEL_ACTOR_REFUSAL;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const named = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function placement(value: Record<string, unknown>): ModelStageTransform {
  return Object.freeze({
    ...(value.position !== undefined && {position: modelPresentationVector(value.position, 'position')}),
    ...(value.rotationQuaternion !== undefined &&
      {rotationQuaternion: modelPresentationRotation(value.rotationQuaternion)}),
    ...(value.scale !== undefined && {scale: modelPresentationVector(value.scale, 'scale')}),
  });
}
function actor(value: unknown, index: number): ModelStageActor {
  if (!object(value) || !named(value.id) || !object(value.asset) || !named(value.asset.id) ||
    !named(value.asset.path) || !object(value.asset.attachments) || !object(value.placement)) {
    throw new ModelStageRefusal(refusal.actor(index));
  }
  if (value.heldAnimation !== undefined && !named(value.heldAnimation)) {
    throw new ModelStageRefusal(refusal.held(value.id));
  }
  const asset = value.asset as unknown as ModelStageAsset;
  return Object.freeze({id: value.id, placement: placement(value.placement),
    asset: Object.freeze({...asset, attachments: Object.freeze({...asset.attachments})}),
    ...(value.heldAnimation !== undefined && {heldAnimation: value.heldAnimation})});
}

// The whole set is checked before any of it is used.
export function modelStageActors(value: unknown, characterId: string): readonly ModelStageActor[] {
  if (!Array.isArray(value)) throw new ModelStageRefusal(refusal.actors);
  const ids = new Set<string>();
  return Object.freeze(Array.from(value, (entry, index) => {
    const next = actor(entry, index);
    if (next.id === characterId) throw new ModelStageRefusal(refusal.character(next.id));
    if (ids.has(next.id)) throw new ModelStageRefusal(refusal.repeated(next.id));
    ids.add(next.id);
    return next;
  }));
}

// Whether two declarations draw the same thing: a kept actor is not reloaded.
export function modelActorIdentity(value: ModelStageActor) {
  const {id, path, revision, sha256, attachments, runtimeMaterials} = value.asset;
  return JSON.stringify([value.id, id, path, revision, sha256, Object.entries(attachments).sort(), runtimeMaterials,
    value.heldAnimation]);
}

export function modelPreviewFrame(value: unknown, actors: ReadonlyMap<string, ModelFrameActor>): ModelPreviewFrame {
  const time = object(value) ? value.simulationTimeSeconds : undefined;
  if (!object(value) || typeof time !== 'number' || !Number.isFinite(time) || time < 0 ||
    !Array.isArray(value.entities)) {
    throw new ModelStageRefusal(refusal.frame);
  }
  if (value.removedEntities !== undefined &&
    (!Array.isArray(value.removedEntities) || value.removedEntities.length)) {
      throw new ModelStageRefusal(refusal.removed);
    }
  const seen = new Set<string>();
  const entities = Array.from(value.entities, (entity: unknown) => {
    if (!object(entity) || !named(entity.entityId)) throw new ModelStageRefusal(refusal.entity);
    const id = entity.entityId, declared = actors.get(id);
    if (!declared) throw new ModelStageRefusal(refusal.undeclared(id));
    if (seen.has(id)) throw new ModelStageRefusal(refusal.twice(id));
    seen.add(id);
    const presentation = modelPreviewPresentation(entity, declared.modelId, declared.runtimeMaterials, id);
    return Object.freeze({...presentation, entityId: id});
  });
  return Object.freeze({simulationTimeSeconds: time, entities: Object.freeze(entities)});
}
