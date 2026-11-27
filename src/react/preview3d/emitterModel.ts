import {modelStates} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import type {ModelStatedValue} from './statedValueModel.ts';

// A particle emitter's profile, as the web stage draws it, and the enums of the pack's `ParticleSubmodule` record by
// Unity's own values (`ParticleSystemCurveMode`, `ParticleSystemGradientMode`, `ParticleSystemSimulationSpace`,
// `ParticleSystemRenderMode`, `ParticleSystemShapeType`, `ShadowCastingMode`, `ParticleSystemGravitySource`) and the
// package's (`ParticleEmitterOrigin`, `ParticleAttraction`). emitterProfileModel.ts reads the record.
export const MODEL_CURVE_MODE = Object.freeze({constant: 0, curve: 1, twoCurves: 2, twoConstants: 3} as const);
export const MODEL_GRADIENT_MODE = Object.freeze(
  {color: 0, gradient: 1, twoColors: 2, twoGradients: 3, randomColor: 4} as const);
export const MODEL_EMITTER_ORIGIN = Object.freeze({character: 0, environment: 1} as const);
export const MODEL_ATTRACTION = Object.freeze({natural: 0, attractToCharacter: 1} as const);
export const MODEL_SIMULATION_SPACE = Object.freeze({local: 0, world: 1, custom: 2} as const);
export const MODEL_RENDER_MODE = Object.freeze({billboard: 0, stretch: 1, horizontalBillboard: 2,
  verticalBillboard: 3, mesh: 4, none: 5} as const);
export const MODEL_GRAVITY_SOURCE = Object.freeze({physics3D: 0, physics2D: 1} as const);
export const MODEL_SHADOW_CASTING = Object.freeze({off: 0, on: 1, twoSided: 2, shadowsOnly: 3} as const);
export const MODEL_SHAPE_TYPE = Object.freeze({sphere: 0, sphereShell: 1, hemisphere: 2, hemisphereShell: 3, cone: 4,
  box: 5, mesh: 6, coneShell: 7, coneVolume: 8, coneVolumeShell: 9, circle: 10, circleEdge: 11, singleSidedEdge: 12,
  meshRenderer: 13, skinnedMeshRenderer: 14, boxShell: 15, boxEdge: 16, donut: 17, rectangle: 18, sprite: 19,
  spriteRenderer: 20} as const);
/** Unity's `ParticleSystemShapeMultiModeValue`: how a shape's `arcMode` spreads particles over its arc. */
export const MODEL_ARC_MODE = Object.freeze({random: 0, loop: 1, pingPong: 2, burstSpread: 3} as const);
/** The shapes the stage draws (emitterSystems.ts maps each onto quarks' own), and their type. */
export const MODEL_EMITTER_DRAWN_SHAPES = Object.freeze([MODEL_SHAPE_TYPE.sphere, MODEL_SHAPE_TYPE.hemisphere,
  MODEL_SHAPE_TYPE.cone, MODEL_SHAPE_TYPE.circle] as const);
export type ModelEmitterDrawnShape = typeof MODEL_EMITTER_DRAWN_SHAPES[number];
// The stage's axes for a record's vectors: it takes them as the engine states them, as it takes an actor's pose
// (asset.ts `applyModelTransform`), so a shape's `position` and its cone's +Z are the stage's unchanged under the
// emitter's parent. Unity turns by `shape.rotation` about Z, then X, then Y (`Quaternion.Euler`): three's YXZ order.
export const MODEL_UNITY_EULER_ORDER = 'YXZ';
/** What a profile draws each particle as: a point (Unity's billboard) or an instance of a mesh (Unity's mesh mode). */
export const MODEL_EMITTER_FORM = Object.freeze({points: 'points', mesh: 'mesh'} as const);
export type ModelEmitterForm = typeof MODEL_EMITTER_FORM[keyof typeof MODEL_EMITTER_FORM];
/** The pack's reference to an asset, as ISM's exporter writes one (`ComponentReference`). */
export const MODEL_ASSET_REFERENCE_FIELDS = Object.freeze(['guid', 'fileID'] as const);
// Unity's built-in resources: the meshes a mesh profile draws, by the fileID their one guid gives each, and the
// segments the stage draws each with (a budget's datum: each particle is this many triangles).
export const MODEL_UNITY_BUILTIN_MESH = Object.freeze({guid: '0000000000000000e000000000000000',
  meshes: Object.freeze([Object.freeze({mesh: 'sphere', fileID: '10207',
    segments: Object.freeze({radius: 0.5, widthSegments: 12, heightSegments: 8})} as const)] as const)});
/** A built-in mesh's row: its name, its fileID and the segments the stage draws it with. */
export type ModelEmitterMesh = typeof MODEL_UNITY_BUILTIN_MESH.meshes[number];
/** A value of the record the stage checks against what it draws. */
export type ModelEmitterValue = number | boolean;
export const MODEL_EMITTER_REFUSAL = Object.freeze({
  undrawn: (where: string, value: ModelEmitterValue, drawn: readonly ModelEmitterValue[]) =>
    `${where} ${value} is not drawn by this stage yet; it draws ${drawn.join(', ')}.`,
  undrawnAsset: (where: string) => `${where} states an asset, which this stage does not draw yet; it draws none.`,
  undrawnMesh: (where: string, guid: string, fileID: string, drawn: readonly string[]) =>
    `${where} names mesh ${guid}:${fileID}, which this stage does not draw yet; it draws Unity's built-in ${
      drawn.join(', ')}.`,
  noContent: (where: string) => `${where} has no content (it is not enabled, or states no material).`,
  endlessBurst: (where: string) =>
    `${where} 0 repeats its burst forever, which this stage does not draw yet; it draws 1 cycle or more.`,
  emitsNothing: (where: string) => `${where} emits nothing: its rate over time is 0 and it has no burst.`,
  undeclared: (entity: string, profile: string) =>
    `Frame entity ${entity} names emitter ${profile}, which its actor does not declare.`,
  burst: (entity: string, profile: string) =>
    `Frame entity ${entity}: emitter ${profile} bursts, which this stage does not draw yet (Burst draws).`,
  stubbed: (entity: string, field: string) =>
    `Frame entity ${entity}: an emitter's ${field} is not drawn by this stage yet.`,
  noGravity: (entity: string, profile: string) =>
    `Frame entity ${entity}: emitter ${profile} falls by the scene's gravity, which no frame has stated yet.`,
  routedValue: (entity: string, profile: string, field: string, is: string) =>
    `Frame entity ${entity}: emitter ${profile}'s routed ${field} must be ${is}.`,
  routedOff: (entity: string, profile: string, field: string, change: string) =>
    `Frame entity ${entity}: emitter ${profile} states a routed ${field} on a ${change}; only a start routes one.`,
  overCap: (where: string, rate: number, lifetime: number, burst: number, cap: number) =>
    `${where}: ${rate} particles a second living up to ${lifetime} s and ${burst} from bursts would pass its cap ` +
    `of ${cap} at once; ` +
    'three.quarks caps no system, so the stage refuses a rate its cap cannot hold.',
  budget: (what: string, value: number, most: number) =>
    `The stage's live ${what} would be ${value}, over its budget of ${most}.`,
});
const refusal = MODEL_EMITTER_REFUSAL;

/** A per-particle value drawn uniformly between `min` and `max`; equal in a constant mode. */
export interface ModelEmitterRange {readonly min: number; readonly max: number}
export type ModelEmitterRgba = readonly [number, number, number, number];
/** How a profile draws a particle: a point, or an instance of the built-in mesh it names (its row); one draw call
 * either way. */
export type ModelEmitterParticle = {readonly form: typeof MODEL_EMITTER_FORM.points} |
  {readonly form: typeof MODEL_EMITTER_FORM.mesh; readonly mesh: ModelEmitterMesh};
export interface ModelEmitterProfile {
  readonly particle: ModelEmitterParticle;
  /** Whether particles follow the actor (`character`) or stay where they were started (`environment`). */
  readonly origin: typeof MODEL_EMITTER_ORIGIN[keyof typeof MODEL_EMITTER_ORIGIN];
  readonly lifetime: ModelEmitterRange;
  readonly speed: ModelEmitterRange;
  /** A particle's diameter in metres at its start. */
  readonly size: ModelEmitterRange;
  readonly color: ModelEmitterRgba;
  /** The profile's own cap: no more particles than this are alive at once. */
  readonly maxParticles: number;
  /** Whether it emits again each `duration` (Unity's `main.looping`), or once for `duration` seconds. */
  readonly looping: boolean;
  readonly duration: number;
  /** Whether its particles stay where they were emitted as the emitter moves (Unity's `main.simulationSpace` World). */
  readonly worldSpace: boolean;
  /** What the scene's gravity is multiplied by for each particle (Unity's `main.gravityModifier`); 0 for none. */
  readonly gravityModifier: number;
  /** Particles a second. */
  readonly rate: number;
  /** Unity's emission burst, none when `emission.hasBurst` is off. */
  readonly bursts: readonly ModelEmitterBurst[];
  /** The most of the bursts' particles alive at once (`modelEmitterLiveBurstParticles`). */
  readonly burstParticles: number;
  /** Where particles start, and their direction. */
  readonly shape: ModelEmitterShape;
  /** What size over lifetime multiplies the size by; one when the module is off. */
  readonly sizeScale: number;
  /** What colour over lifetime and colour by speed multiply the start colour by; white when both are off. */
  readonly tint: ModelEmitterRgba;
  /** Unity's velocity over lifetime; none when the module is off. */
  readonly velocity: ModelEmitterVelocity | null;
}
/** Unity's velocity over lifetime: each particle's own `linear` velocity in metres a second by axis, stated in world
 * space or the emitter's (`worldSpace`), and what the particle's whole speed is multiplied by (`speedModifier`). */
export interface ModelEmitterVelocity {
  readonly linear: readonly [ModelEmitterRange, ModelEmitterRange, ModelEmitterRange];
  readonly speedModifier: ModelEmitterRange;
  readonly worldSpace: boolean;
}
/** One of Unity's emission bursts: `count` particles at `time` seconds into each run, `cycles` times `interval`
 * apart, each with `probability`. */
export interface ModelEmitterBurst {
  readonly time: number;
  readonly count: number;
  readonly cycles: number;
  readonly interval: number;
  readonly probability: number;
}
/** Unity's shape module: a shape of `type` and `radius` metres, emitting from its outer `thickness` share of it
 * (Unity's `radiusThickness`), over `arc` degrees, offset by `position` metres and turned by `rotation` degrees
 * (`MODEL_UNITY_EULER_ORDER`); a cone spreads by `angle` degrees: Unity's units, which the drawing converts. Off,
 * Unity emits from the emitter's centre: a sphere of no radius. */
export interface ModelEmitterShape {
  readonly type: ModelEmitterDrawnShape;
  readonly radius: number;
  readonly thickness: number;
  readonly arc: number;
  readonly angle: number;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}
export type ModelEmitterProfiles = Readonly<Record<string, ModelEmitterProfile>>;
/** A record of actor `actor` the stage does not draw yet, by its profile id: the `setting` (its path in the record)
 * holding the first value the stage does not draw, and the refusal its reader made. */
export interface ModelEmitterSkip {
  readonly actor: string;
  readonly profile: string;
  readonly setting: string;
  readonly refusal: string;
}
/** What the stage draws of an actor's records, and each record it skips: a skipped profile never refuses the stage. */
export interface ModelEmitterDrawing {
  readonly drawn: ModelEmitterProfiles;
  readonly skipped: readonly ModelEmitterSkip[];
}
/** A pack's `ParticleSubmodule` record, checked whole and kept as stated: the description's form, which reads back as
 * itself. The stage draws its profile from it (`modelEmitterDrawing`). */
export type ModelEmitterRecord = {readonly [field: string]: ModelStatedValue};
export type ModelEmitterRecords = Readonly<Record<string, ModelEmitterRecord>>;
export const MODEL_NO_EMITTERS: ModelEmitterRecords = Object.freeze({});

/** What an actor declares under `profile`, refused by name when it declares nothing there. */
export function modelDeclaredEmitter<T>(declared: Readonly<Record<string, T>>, entity: string, profile: string): T {
  if (!modelStates(declared, profile)) throw new ModelStageRefusal(refusal.undeclared(entity, profile));
  return declared[profile];
}
