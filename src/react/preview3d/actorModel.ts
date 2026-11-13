import type {ModelRotation, ModelStageAsset, ModelStageTransform, ModelVector} from './model.ts';
import type {ModelPreviewEntity} from './presentation.ts';
import {MODEL_PREVIEW_ENTITY_REFUSAL, modelPresentationRotation, modelPresentationVector, modelPreviewEntity}
  from './presentation.ts';
import type {ModelAnimationSample} from './animationLayerModel.ts';
import {modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// Actor ids are the host's. A frame's entities are keyed by actor id and the host owns the mapping from an engine's
// entity ids to them. Two actors may share one asset, so an actor's id is never taken from its asset.
/** An actor's host animation: what it plays while no engine frame drives it. */
export interface ModelStageActorAnimation {
  /** An animation in the asset's file, or MODEL_REST_POSE. */
  readonly name: string;
  /** Advances on the stage's local clock. */
  readonly playing: boolean;
  /** Holds the clip at this time in seconds; only while not playing. Omitted, the clock keeps the clip's time. */
  readonly timeSeconds?: number;
}
export interface ModelStageActor {
  readonly id: string;
  readonly asset: ModelStageAsset;
  /** Where the host stands the actor; a component it leaves out is the identity. */
  readonly placement: ModelStageTransform;
  readonly animation: ModelStageActorAnimation;
}
/** Every actor on the stage, and the one the camera fits and the snapshot's top level reports. */
export interface ModelStageActorSet {
  readonly focus: string;
  readonly actors: readonly ModelStageActor[];
}
export const MODEL_STAGE_DRIVER = Object.freeze({host: 'host', engine: 'engine'} as const);
export type ModelStageDriver = typeof MODEL_STAGE_DRIVER[keyof typeof MODEL_STAGE_DRIVER];
// The stage's own frame, built by the host: every entity names a declared actor, so an unknown id is refused.
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
  readonly animation: string;
  readonly samples: readonly ModelAnimationSample[];
}
export const MODEL_ACTOR_REFUSAL = Object.freeze({
  set: 'Declared actors require a focus and a non-empty actors array.',
  actor: (index: number) => `Actor ${index} requires an id, an asset with an id, path and attachments, ` +
    'a placement and an animation.',
  animation: (id: string) => `Actor ${id}: an animation requires a name, a playing flag and, when held, ` +
    'a finite nonnegative timeSeconds.',
  heldPlaying: (id: string) => `Actor ${id}: a held timeSeconds does not play.`,
  repeated: (id: string) => `Actor ${id} is declared twice.`,
  focus: (id: string) => `The focus ${id} names no declared actor.`,
  frame: 'A frame requires a finite nonnegative simulationTimeSeconds and an entities array.',
  removed: 'This stage removes no actor from an engine frame; removedEntities must be empty.',
  undeclared: (id: string) => `Frame entity ${id} names no declared actor; engine records do not create actors.`,
  twice: (id: string) => `Frame entity ${id} appears twice.`,
  profile: (id: string) => `Actor ${id}: the runtime material profile belongs to another asset or revision.`,
  digest: (id: string) => `Actor ${id}: the runtime material profile does not match the asset's SHA-256.`,
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
function animation(value: unknown, id: string): ModelStageActorAnimation {
  const time = object(value) ? value.timeSeconds : undefined;
  if (!object(value) || !named(value.name) || typeof value.playing !== 'boolean' || (time !== undefined &&
    (typeof time !== 'number' || !Number.isFinite(time) || time < 0))) {
    throw new ModelStageRefusal(refusal.animation(id));
  }
  if (time !== undefined && value.playing) throw new ModelStageRefusal(refusal.heldPlaying(id));
  return Object.freeze({name: value.name, playing: value.playing, ...(time !== undefined && {timeSeconds: time})});
}
function actor(value: unknown, index: number): ModelStageActor {
  if (!object(value) || !named(value.id) || !object(value.asset) || !named(value.asset.id) ||
    !named(value.asset.path) || !object(value.asset.attachments) || !object(value.placement)) {
    throw new ModelStageRefusal(refusal.actor(index));
  }
  const asset = value.asset as unknown as ModelStageAsset;
  return Object.freeze({id: value.id, placement: placement(value.placement),
    asset: Object.freeze({...asset, attachments: Object.freeze({...asset.attachments})}),
    animation: animation(value.animation, value.id)});
}

/** The focused actor of a set; refused when the focus names none of them. */
export function modelStageFocus(value: ModelStageActorSet): ModelStageActor {
  const focused = value.actors.find(candidate => candidate.id === value.focus);
  if (!focused) throw new ModelStageRefusal(refusal.focus(value.focus));
  return focused;
}

/** The whole set is checked before any of it is used. */
export function modelStageActorSet(value: unknown): ModelStageActorSet {
  if (!object(value) || !named(value.focus) || !Array.isArray(value.actors) || !value.actors.length) {
    throw new ModelStageRefusal(refusal.set);
  }
  const ids = new Set<string>();
  const actors = Object.freeze(Array.from(value.actors, (entry: unknown, index) => {
    const next = actor(entry, index);
    if (ids.has(next.id)) throw new ModelStageRefusal(refusal.repeated(next.id));
    ids.add(next.id);
    return next;
  }));
  const set = Object.freeze({focus: value.focus, actors});
  modelStageFocus(set);
  return set;
}

/** Whether two declarations draw the same loaded asset: a kept actor is not reloaded. Host state is not identity. */
export function modelActorIdentity(value: ModelStageActor) {
  const {id, path, revision, sha256, attachments, runtimeMaterials} = value.asset;
  return JSON.stringify([value.id, id, path, revision, sha256, Object.entries(attachments).sort(), runtimeMaterials]);
}
/** Whether a kept actor's host state (placement or animation) changes. */
export const modelActorHostChanged = (previous: ModelStageActor, next: ModelStageActor) =>
  JSON.stringify([previous.placement, previous.animation]) !== JSON.stringify([next.placement, next.animation]);

/** An actor's runtime material profile, bound to its asset's exact identity; none when its asset declares none. */
export function modelRuntimeAssetProfile(value: ModelStageActor) {
  const {asset} = value;
  if (!asset.runtimeMaterials) return undefined;
  const profile = modelRuntimeMaterialProfile(asset.runtimeMaterials);
  if (profile.asset.id !== asset.id || profile.asset.revision !== asset.revision) {
    throw new ModelStageRefusal(refusal.profile(value.id));
  }
  if (asset.sha256 !== undefined && asset.sha256 !== profile.asset.sha256) {
    throw new ModelStageRefusal(refusal.digest(value.id));
  }
  return profile;
}

export function modelPreviewFrame(value: unknown, actors: readonly ModelStageActor[]): ModelPreviewFrame {
  const time = object(value) ? value.simulationTimeSeconds : undefined;
  if (!object(value) || typeof time !== 'number' || !Number.isFinite(time) || time < 0 ||
    !Array.isArray(value.entities)) {
    throw new ModelStageRefusal(refusal.frame);
  }
  if (value.removedEntities !== undefined &&
    (!Array.isArray(value.removedEntities) || value.removedEntities.length)) {
    throw new ModelStageRefusal(refusal.removed);
  }
  const declared = new Map(actors.map(entry => [entry.id, entry])), seen = new Set<string>();
  const entities = Array.from(value.entities, (entity: unknown) => {
    const id = object(entity) ? entity.entityId : undefined;
    if (!named(id)) throw new ModelStageRefusal(MODEL_PREVIEW_ENTITY_REFUSAL.entity);
    const actor = declared.get(id);
    if (!actor) throw new ModelStageRefusal(refusal.undeclared(id));
    if (seen.has(id)) throw new ModelStageRefusal(refusal.twice(id));
    seen.add(id);
    return modelPreviewEntity(entity, actor.asset.id, modelRuntimeAssetProfile(actor));
  });
  return Object.freeze({simulationTimeSeconds: time, entities: Object.freeze(entities)});
}
