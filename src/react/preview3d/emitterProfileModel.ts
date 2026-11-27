import {modelFlag, modelNumber, modelOption, modelRecord} from './recordModel.ts';
import {ModelStageRefusal, ModelStageUndrawn} from './refusal.ts';
import {MODEL_ARC_MODE, MODEL_ASSET_REFERENCE_FIELDS, MODEL_ATTRACTION, MODEL_EMITTER_FORM, MODEL_EMITTER_ORIGIN,
  MODEL_GRAVITY_SOURCE, MODEL_UNITY_BUILTIN_MESH, MODEL_EMITTER_REFUSAL as refusal, MODEL_RENDER_MODE,
  MODEL_SHADOW_CASTING, MODEL_SHAPE_TYPE, MODEL_SIMULATION_SPACE, type ModelEmitterBurst, type ModelEmitterMesh,
  type ModelEmitterParticle, type ModelEmitterProfile, type ModelEmitterRgba, type ModelEmitterShape}
  from './emitterModel.ts';
import {MODEL_EMITTER_BUDGET, modelEmitterCapRefusal, modelEmitterLiveBurstParticles, modelEmitterOverCap}
  from './emitterBudgetModel.ts';
import {MODEL_EMITTER_DRAWN as DRAWN, MODEL_EMITTER_DRAWN_VALUE as DRAWN_VALUE, modelEmitterColor as color,
  modelEmitterCurve as curve, modelEmitterDrawn as drawn, modelEmitterDrawnFlag as drawnFlag,
  modelEmitterDrawnNumber as drawnNumber, modelEmitterDrawnOption as drawnOption,
  modelEmitterDrawnVector as drawnVector, modelEmitterGradient as gradient, modelEmitterHeldAtZero as heldAtZero,
  modelEmitterModule as module, modelEmitterSigned as signed, modelEmitterUnbounded as unbounded,
  modelEmitterVector as vector}
  from './emitterValueModel.ts';
import {MODEL_PARTICLE_FIELDS as FIELDS} from './particleSubmoduleFields.ts';

// Reads the pack's whole `ParticleSubmodule` record as ISM's C# serializes it, checked with no renderer. Each struct
// states exactly its serialized fields. What the stage does not draw is refused by name by its own value
// (emitterValueModel.ts): a module by its `enabled` flag, a setting by a value other than the one the stage draws, an
// enum by a value it does not draw yet. Fields the engine decides with (validation, emission probability, contact,
// and `blendMode`, ISM's `CompositeMode`: how nested submodules compose, not how particles blend) or the editor keeps
// (prefab source) are the record's and not drawn. A constant mode reads no curve, as in Unity, so a record's curves
// beside one are unread, and so are a mesh beside a billboard and the shape's texture settings beside no texture. The
// material is the owner's to decide; the stage draws a named placeholder (`MODEL_EMITTER_PLACEHOLDER`,
// emitterSystems.ts).
// The modules the stage does not draw yet, each refused when enabled.
// Noise: quarks' `Noise` moves a particle by a 2D simplex noise read along its age alone, where Unity's samples a
// noise field at the particle's position; rotation: a mesh's axis against Unity's is unverified, and a billboard's
// direction untested; the texture sheet: the placeholder disc has no frames.
export const MODEL_EMITTER_UNDRAWN_MODULES = Object.freeze({noiseSettings: FIELDS.noise,
  rotationOverLifetime: FIELDS.axisCurve, rotationBySpeed: FIELDS.axisCurve,
  textureSheetAnimation: FIELDS.textureSheet});
const START_ROTATION = FIELDS.vector3.map(axis => `startRotation${axis.toUpperCase()}`);
const WHITE: ModelEmitterRgba = Object.freeze([1, 1, 1, 1]);

// Unity's `main` module: `looping` and `duration`, `simulationSpace`, the start values, and the gravity modifier of
// the scene's 3D gravity.
function main(value: unknown, where: string) {
  const record = modelRecord(value, FIELDS.main, where);
  drawnFlag(record.startRotation3D, DRAWN_VALUE.off, `${where}.startRotation3D`);
  for (const axis of START_ROTATION) heldAtZero(record[axis], `${where}.${axis}`);
  const space = drawnOption(record.simulationSpace, MODEL_SIMULATION_SPACE, DRAWN.space, `${where}.simulationSpace`);
  drawnNumber(record.simulationSpeed, DRAWN_VALUE.unscaled, `${where}.simulationSpeed`);
  const gravityModifier = curve(record.gravityModifier, `${where}.gravityModifier`, DRAWN.gravity, signed).max;
  // A modifier of 0 falls by no gravity, so its source decides nothing drawn.
  const source = modelOption(record.gravitySource, MODEL_GRAVITY_SOURCE, `${where}.gravitySource`);
  if (gravityModifier !== 0) drawn(source, DRAWN.gravitySource, `${where}.gravitySource`);
  return {looping: modelFlag(record.looping, `${where}.looping`),
    duration: modelNumber(record.duration, `${where}.duration`, Number.MIN_VALUE, Number.POSITIVE_INFINITY),
    worldSpace: space === MODEL_SIMULATION_SPACE.world,
    lifetime: curve(record.startLifetime, `${where}.startLifetime`),
    // Unity's start speed is signed: a negative one moves a particle against its shape's direction.
    speed: curve(record.startSpeed, `${where}.startSpeed`, DRAWN.curve, signed),
    size: curve(record.startSize, `${where}.startSize`),
    gravityModifier,
    color: color(record.startColor, `${where}.startColor`),
    maxParticles: modelNumber(record.maxParticles, `${where}.maxParticles`, 1, MODEL_EMITTER_BUDGET.particles)};
}
// Unity's `Burst.cycleCount`: 0 repeats the burst forever, which quarks cannot.
function burstCycles(value: unknown, where: string) {
  const cycles = unbounded(value, where);
  if (cycles === 0) throw new ModelStageUndrawn(where, refusal.endlessBurst(where));
  return cycles;
}
// Unity's `emission` module: `rateOverTime` and its one burst (`burstTime`, `burstCount`, `burstCycleCount`,
// `burstRepeatInterval`, `burstProbability`).
function emission(value: unknown, where: string) {
  const record = modelRecord(value, FIELDS.emission, where);
  heldAtZero(record.rateOverDistance, `${where}.rateOverDistance`);
  const {max: rate} = curve(record.rateOverTime, `${where}.rateOverTime`, DRAWN.rate);
  const bursts: readonly ModelEmitterBurst[] = modelFlag(record.hasBurst, `${where}.hasBurst`) ?
    [Object.freeze({time: unbounded(record.burstTime, `${where}.burstTime`),
      count: modelNumber(record.burstCount, `${where}.burstCount`, 0, MODEL_EMITTER_BUDGET.particles),
      cycles: burstCycles(record.burstCycleCount, `${where}.burstCycleCount`),
      interval: unbounded(record.burstRepeatInterval, `${where}.burstRepeatInterval`),
      probability: modelNumber(record.burstProbability, `${where}.burstProbability`, 0, 1)})] : [];
  if (rate === 0 && bursts.every(({count}) => count === 0)) throw new ModelStageRefusal(refusal.emitsNothing(where));
  return {rate, bursts: Object.freeze(bursts)};
}
// An asset the record names, in the one form the pack states one (`MODEL_ASSET_REFERENCE_FIELDS`); Unity's own
// serialized form, which adds `type`, is the pack writer's to convert, so the stage refuses it whole.
const assetReference = (value: unknown, where: string) => modelRecord(value, MODEL_ASSET_REFERENCE_FIELDS, where);
const ORIGIN = Object.freeze([0, 0, 0] as const);
const WHOLE_TURN = 360;
const NO_SHAPE: ModelEmitterShape = Object.freeze({type: MODEL_SHAPE_TYPE.sphere, radius: 0, thickness: 1,
  arc: WHOLE_TURN, angle: 0, position: ORIGIN, rotation: ORIGIN});
// Unity's `shape` module: `shapeType`, `radius`, `radiusThickness`, `arc` and `angle` in degrees, `position`, and
// `rotation` in degrees.
const shape = (value: unknown, where: string) => module(value, FIELDS.shape, where, record => {
  const type = drawnOption(record.shapeType, MODEL_SHAPE_TYPE, DRAWN.shape, `${where}.shapeType`);
  drawnOption(record.arcMode, MODEL_ARC_MODE, DRAWN.arcMode, `${where}.arcMode`);
  drawnVector(record.scale, DRAWN_VALUE.unstretched, `${where}.scale`);
  drawnFlag(record.alignToDirection, DRAWN_VALUE.off, `${where}.alignToDirection`);
  if (record.texture !== null) {
    assetReference(record.texture, `${where}.texture`);
    throw new ModelStageUndrawn(`${where}.texture`, refusal.undrawnAsset(`${where}.texture`));
  }
  return Object.freeze({type, radius: unbounded(record.radius, `${where}.radius`),
    thickness: modelNumber(record.radiusThickness, `${where}.radiusThickness`, 0, 1),
    arc: modelNumber(record.arc, `${where}.arc`, 0, WHOLE_TURN),
    angle: modelNumber(record.angle, `${where}.angle`, 0, WHOLE_TURN / 4),
    position: vector(record.position, `${where}.position`), rotation: vector(record.rotation, `${where}.rotation`)});
}, NO_SHAPE);

// Unity's `velocityOverLifetime`: `x`, `y` and `z` (the record's `linearX`, `linearY`, `linearZ`) in `space`, and
// `speedModifier`; its orbital and radial velocity, which quarks has no behaviour for, held at zero.
const HELD_VELOCITY = ['orbitalX', 'orbitalY', 'orbitalZ', 'orbitalOffsetX', 'orbitalOffsetY', 'orbitalOffsetZ',
  'radial'] as const;
const LINEAR = FIELDS.vector3.map(axis => `linear${axis.toUpperCase()}`);
const velocity = (value: unknown, where: string) => module(value, FIELDS.velocity, where, record => {
  for (const field of HELD_VELOCITY) heldAtZero(record[field], `${where}.${field}`);
  const [x, y, z] = LINEAR.map(field => curve(record[field], `${where}.${field}`, DRAWN.curve, signed));
  const space = drawnOption(record.space, MODEL_SIMULATION_SPACE, DRAWN.space, `${where}.space`);
  return Object.freeze({linear: Object.freeze([x, y, z] as const), worldSpace: space === MODEL_SIMULATION_SPACE.world,
    speedModifier: curve(record.speedModifier, `${where}.speedModifier`, DRAWN.curve, signed)});
}, null);
// A constant colour by speed is the same colour at every speed, so it multiplies as colour over lifetime does.
const tinted = ([r, g, b, a]: ModelEmitterRgba, [byR, byG, byB, byA]: ModelEmitterRgba): ModelEmitterRgba =>
  Object.freeze([r * byR, g * byG, b * byB, a * byA]);
const COLOR_MODULES = ['colorOverLifetime', 'colorBySpeed'] as const;
const tint = (record: Record<string, unknown>, where: string) => COLOR_MODULES.map(name =>
  module(record[name], FIELDS.color, `${where}.${name}`, color => gradient(color.color, `${where}.${name}.color`),
    WHITE)).reduce(tinted);

// The built-in mesh a mesh profile names; any other asset is refused by its reference.
function builtinMesh(value: unknown, where: string): ModelEmitterMesh {
  const {guid, fileID} = assetReference(value, where);
  const {meshes} = MODEL_UNITY_BUILTIN_MESH;
  const named = guid === MODEL_UNITY_BUILTIN_MESH.guid ? meshes.find(builtin => builtin.fileID === fileID) : undefined;
  if (!named) {
    throw new ModelStageUndrawn(where,
      refusal.undrawnMesh(where, String(guid), String(fileID), meshes.map(({mesh}) => mesh)));
  }
  return named;
}
// Unity reads the mesh only in mesh mode, so a billboard's mesh is unread.
function particle(record: Record<string, unknown>, where: string): ModelEmitterParticle {
  const mode = drawnOption(record.renderMode, MODEL_RENDER_MODE, DRAWN.render, `${where}.renderMode`);
  return Object.freeze(mode === MODEL_RENDER_MODE.mesh ?
    {form: MODEL_EMITTER_FORM.mesh, mesh: builtinMesh(record.mesh, `${where}.mesh`)} :
    {form: MODEL_EMITTER_FORM.points});
}

/** One profile, checked whole. */
export function modelEmitterProfile(value: unknown, where: string): ModelEmitterProfile {
  const record = modelRecord(value, FIELDS.submodule, where);
  if (!modelFlag(record.enabled, `${where}.enabled`) || record.material === null) {
    throw new ModelStageRefusal(refusal.noContent(where));
  }
  drawnOption(record.attraction, MODEL_ATTRACTION, DRAWN.attraction, `${where}.attraction`);
  drawnOption(record.shadowCasting, MODEL_SHADOW_CASTING, DRAWN.shadow, `${where}.shadowCasting`);
  drawnFlag(record.emitOnContact, DRAWN_VALUE.off, `${where}.emitOnContact`);
  for (const [name, fields] of Object.entries(MODEL_EMITTER_UNDRAWN_MODULES)) {
    const undrawn = modelRecord(record[name], fields, `${where}.${name}`);
    drawnFlag(undrawn.enabled, DRAWN_VALUE.off, `${where}.${name}.enabled`);
  }
  const started = main(record.mainSettings, `${where}.mainSettings`);
  const emitted = emission(record.emissionSettings, `${where}.emissionSettings`);
  const profile: ModelEmitterProfile = Object.freeze({
    particle: particle(record, where),
    origin: modelOption(record.emitterOrigin, MODEL_EMITTER_ORIGIN, `${where}.emitterOrigin`),
    ...started, ...emitted, burstParticles: modelEmitterLiveBurstParticles(emitted.bursts, started.lifetime.max,
      started.looping, started.duration),
    shape: shape(record.shapeSettings, `${where}.shapeSettings`),
    sizeScale: module(record.sizeOverLifetime, FIELDS.axisCurve, `${where}.sizeOverLifetime`, size => {
      drawnFlag(size.separateAxes, DRAWN_VALUE.off, `${where}.sizeOverLifetime.separateAxes`);
      return curve(size.x, `${where}.sizeOverLifetime.x`, DRAWN.overLifetime).max;
    }, 1),
    tint: tint(record, where),
    velocity: velocity(record.velocitySettings, `${where}.velocitySettings`),
  });
  if (modelEmitterOverCap(profile, profile.rate)) throw modelEmitterCapRefusal(where, profile, profile.rate);
  return profile;
}
