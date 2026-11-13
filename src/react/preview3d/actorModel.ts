import type {ModelStageAsset} from './model.ts';
import {modelPresentationPose, type ModelPresentationPose} from './placementModel.ts';
import type {ModelAnimationSample} from './animationLayerModel.ts';
import {modelRuntimeMaterialProfile} from './runtimeMaterialModel.ts';
import {modelDigest, modelName, modelNumber, modelRecord, modelRecordStating, modelShape, modelStates}
  from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_ACTOR_SURFACES, modelActorSurfaces, type ModelActorSurfaces} from './surfaceModel.ts';

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
  /** What draws the file's renderers: its own materials throughout, or a named set of the description's. */
  readonly surfaces: ModelActorSurfaces;
}
/** Every actor on the stage, and the one the camera fits and the snapshot's top level reports. */
export interface ModelStageActorSet {
  readonly focus: string;
  readonly actors: readonly ModelStageActor[];
}
export const MODEL_STAGE_DRIVER = Object.freeze({host: 'host', engine: 'engine'} as const);
export type ModelStageDriver = typeof MODEL_STAGE_DRIVER[keyof typeof MODEL_STAGE_DRIVER];
export interface ModelStageActorSnapshot {
  readonly id: string;
  readonly modelId: string;
  readonly driver: ModelStageDriver;
  readonly pose: ModelPresentationPose;
  readonly animation: string;
  readonly samples: readonly ModelAnimationSample[];
}
const ACTOR_SET_FIELDS = Object.freeze(['focus', 'actors']);
const ACTOR_FIELDS = Object.freeze(['id', 'asset', 'placement', 'animation', 'surfaces']);
// What an asset states: its id and path always; its revision, digest and runtime profile when it has them (Workbench's
// catalogue knows no revision; whether every asset states its digest is the owner's question). One it names is stated
// with a value and checked; a field outside these is refused, never carried.
const ASSET_FIELDS = Object.freeze({stated: ['id', 'path'], whenStated: ['revision', 'sha256', 'runtimeMaterials']});
export const MODEL_ACTOR_REFUSAL = Object.freeze({
  set: 'Declared actors require a focus and a non-empty actors array.',
  repeated: (id: string) => `Actor ${id} is declared twice.`,
  focus: (id: string) => `The focus ${id} names no declared actor.`,
  frame: 'A frame requires a finite nonnegative simulationTimeSeconds and an entities array.',
  removed: 'This stage removes no actor from an engine frame; removedEntities must be empty.',
  undeclared: (id: string) => `Frame entity ${id} names no declared actor; engine records do not create actors.`,
  twice: (id: string) => `Frame entity ${id} appears twice.`,
  profile: (id: string) => `Actor ${id}: the runtime material profile belongs to another asset or revision.`,
  digest: (id: string) => `Actor ${id}: the runtime material profile does not match the asset's SHA-256.`,
  routes: (id: string) => `Actor ${id} states a runtime material profile and a surface set: two routes for engine ` +
    'values. A set\'s renderers take them by their kinds; the profile route leaves in step 5e.',
});
const refusal = MODEL_ACTOR_REFUSAL;

function animation(value: unknown, where: string): ModelStageActorAnimation {
  const {shape, record} = modelShape(value, 'kind', ANIMATION_FIELDS, where);
  if (shape === MODEL_ACTOR_ANIMATION.rest) return Object.freeze({kind: shape});
  const name = modelName(record.name, `${where}.name`);
  if (shape === MODEL_ACTOR_ANIMATION.playing) return Object.freeze({kind: shape, name});
  return Object.freeze({kind: shape, name,
    timeSeconds: modelNumber(record.timeSeconds, `${where}.timeSeconds`, 0, Number.POSITIVE_INFINITY)});
}
function asset(value: unknown, where: string): ModelStageAsset {
  const record = modelRecordStating(value, ASSET_FIELDS, where);
  return Object.freeze({id: modelName(record.id, `${where}.id`), path: modelName(record.path, `${where}.path`),
    ...(modelStates(record, 'revision') && {revision: modelName(record.revision, `${where}.revision`)}),
    ...(modelStates(record, 'sha256') && {sha256: modelDigest(record.sha256, `${where}.sha256`)}),
    ...(modelStates(record, 'runtimeMaterials') &&
      {runtimeMaterials: modelRuntimeMaterialProfile(record.runtimeMaterials)})});
}
function actor(value: unknown, index: number): ModelStageActor {
  const record = modelRecord(value, ACTOR_FIELDS, `Actor ${index}`);
  const id = modelName(record.id, `Actor ${index}.id`);
  const declared = asset(record.asset, `Actor ${id}.asset`);
  const surfaces = modelActorSurfaces(record.surfaces, `Actor ${id}.surfaces`);
  if (declared.runtimeMaterials && surfaces.from === MODEL_ACTOR_SURFACES.set) {
    throw new ModelStageRefusal(refusal.routes(id));
  }
  return Object.freeze({id, asset: declared, placement: modelPresentationPose(record.placement,
    `Actor ${id} placement`), animation: animation(record.animation, `Actor ${id}.animation`), surfaces});
}

/** The focused actor of a set; refused when the focus names none of them. */
export function modelStageFocus(value: ModelStageActorSet): ModelStageActor {
  const focused = value.actors.find(candidate => candidate.id === value.focus);
  if (!focused) throw new ModelStageRefusal(refusal.focus(value.focus));
  return focused;
}

/** The whole set is checked before any of it is used. */
export function modelStageActorSet(value: unknown): ModelStageActorSet {
  const record = modelRecord(value, ACTOR_SET_FIELDS, 'The actors');
  const focus = modelName(record.focus, 'The actors.focus');
  if (!Array.isArray(record.actors) || !record.actors.length) throw new ModelStageRefusal(refusal.set);
  const ids = new Set<string>();
  const actors = Object.freeze(Array.from(record.actors, (entry: unknown, index) => {
    const next = actor(entry, index);
    if (ids.has(next.id)) throw new ModelStageRefusal(refusal.repeated(next.id));
    ids.add(next.id);
    return next;
  }));
  const set = Object.freeze({focus, actors});
  modelStageFocus(set);
  return set;
}

/** Whether two declarations draw the same loaded asset: a kept actor is not reloaded. Host state is not identity. */
export function modelActorIdentity(value: ModelStageActor) {
  const {id, path, revision, sha256, runtimeMaterials} = value.asset;
  return JSON.stringify([value.id, id, path, revision, sha256, runtimeMaterials]);
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

/**
 * The digest an actor's file is read against (files.ts): its runtime profile's while it states one (until step 5e
 * removes the profile; the asset's own, when stated, must equal it), else the asset's own; none stated, the file is
 * read unverified.
 */
export function modelAssetDigest(value: ModelStageActor): string | undefined {
  const profile = modelRuntimeAssetProfile(value);
  return profile ? profile.asset.sha256 : value.asset.sha256;
}
