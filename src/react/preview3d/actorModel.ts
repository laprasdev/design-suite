import type {ModelStageAsset} from './model.ts';
import {modelPresentationPose, type ModelPresentationPose} from './placementModel.ts';
import {MODEL_PREVIEW_ENTITY_REFUSAL, modelPreviewEntity, type ModelPreviewEntity} from './presentation.ts';
import type {ModelAnimationSample} from './animationLayerModel.ts';
import {modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// Actor ids are the host's. A frame's entities are keyed by actor id and the host owns the mapping from an engine's
// entity ids to them. Two actors may share one asset, so an actor's id is never taken from its asset.
export const MODEL_ACTOR_ANIMATION = Object.freeze({rest: 'rest', playing: 'playing', held: 'held'} as const);
/**
 * An actor's host animation, what it shows while no engine frame drives it, in one of three whole shapes: the rest
 * pose; a clip in the asset's file playing on the stage's local clock; or a clip held at a stated time in seconds.
 */
export type ModelStageActorAnimation =
  | {readonly kind: typeof MODEL_ACTOR_ANIMATION.rest}
  | {readonly kind: typeof MODEL_ACTOR_ANIMATION.playing; readonly name: string}
  | {readonly kind: typeof MODEL_ACTOR_ANIMATION.held; readonly name: string; readonly timeSeconds: number};
// The fields each shape states, and nothing else: a field of another shape is refused, never dropped.
const ANIMATION_FIELDS: Readonly<Record<ModelStageActorAnimation['kind'], readonly string[]>> = Object.freeze({
  rest: ['kind'], playing: ['kind', 'name'], held: ['kind', 'name', 'timeSeconds']});
export interface ModelStageActor {
  readonly id: string;
  readonly asset: ModelStageAsset;
  /** Where the host stands the actor, whole: position, rotation and scale are all stated. */
  readonly placement: ModelPresentationPose;
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
  readonly pose: ModelPresentationPose;
  readonly animation: string;
  readonly samples: readonly ModelAnimationSample[];
}
export const MODEL_ACTOR_REFUSAL = Object.freeze({
  set: 'Declared actors require a focus and a non-empty actors array.',
  actor: (index: number) => `Actor ${index} requires an id, an asset with an id, path and attachments, ` +
    'a placement and an animation.',
  animation: (id: string) => `Actor ${id}: an animation is the rest pose, a clip playing, or a clip held at a time; ` +
    `its kind is one of ${Object.values(MODEL_ACTOR_ANIMATION).join(', ')}.`,
  field: (id: string, kind: string, field: string) => `Actor ${id}: a ${kind} animation does not state ${field}.`,
  clip: (id: string, kind: string) => `Actor ${id}: a ${kind} animation names a clip.`,
  time: (id: string) => `Actor ${id}: a held animation states a finite nonnegative timeSeconds.`,
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

function animation(value: unknown, id: string): ModelStageActorAnimation {
  const kind = object(value) ? value.kind : undefined;
  const shape = Object.values(MODEL_ACTOR_ANIMATION).find(candidate => candidate === kind);
  if (!object(value) || !shape) throw new ModelStageRefusal(refusal.animation(id));
  const stray = Object.keys(value).find(field => !ANIMATION_FIELDS[shape].includes(field));
  if (stray) throw new ModelStageRefusal(refusal.field(id, shape, stray));
  if (shape === MODEL_ACTOR_ANIMATION.rest) return Object.freeze({kind: shape});
  if (!named(value.name)) throw new ModelStageRefusal(refusal.clip(id, shape));
  if (shape === MODEL_ACTOR_ANIMATION.playing) return Object.freeze({kind: shape, name: value.name});
  const time = value.timeSeconds;
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) throw new ModelStageRefusal(refusal.time(id));
  return Object.freeze({kind: shape, name: value.name, timeSeconds: time});
}
function actor(value: unknown, index: number): ModelStageActor {
  if (!object(value) || !named(value.id) || !object(value.asset) || !named(value.asset.id) ||
    !named(value.asset.path) || !object(value.asset.attachments) || !object(value.placement)) {
    throw new ModelStageRefusal(refusal.actor(index));
  }
  const asset = value.asset as unknown as ModelStageAsset;
  return Object.freeze({id: value.id, placement: modelPresentationPose(value.placement, `Actor ${value.id} placement`),
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
