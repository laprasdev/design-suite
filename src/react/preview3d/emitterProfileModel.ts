import {modelEntries, modelFlag, modelNumber, modelOption, modelRecord} from './recordModel.ts';
import {axes, color, curve, drawnFlag, drawnNumber, drawnOption, drawnVector, gradient, heldAt, module, unbounded,
  MODEL_EMITTER_DRAWN as DRAWN, MODEL_EMITTER_DRAWN_VALUE as DRAWN_VALUE} from './emitterValueModel.ts';
import {modelStatedRecord} from './statedValueModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_ASSET_REFERENCE_FIELDS, MODEL_ATTRACTION, MODEL_CURVE_MODE, MODEL_EMITTER_BUDGET, MODEL_EMITTER_FORM,
  MODEL_EMITTER_ORIGIN, MODEL_UNITY_BUILTIN_MESH, MODEL_EMITTER_REFUSAL as refusal, MODEL_RENDER_MODE,
  MODEL_SHADOW_CASTING, MODEL_SHAPE_TYPE, MODEL_SIMULATION_SPACE, type ModelEmitterBetween,
  type ModelEmitterMesh, type ModelEmitterParticle, type ModelEmitterProfile, type ModelEmitterProfiles,
  type ModelEmitterRecord, type ModelEmitterRecords, type ModelEmitterRgba}
  from './emitterModel.ts';
import {MODEL_PARTICLE_FIELDS as FIELDS} from './particleSubmoduleFields.ts';
import type {ModelVector} from './placementModel.ts';

// Reads the pack's whole `ParticleSubmodule` record as ISM's C# serializes it, checked with no renderer. Each struct
// states exactly its serialized fields. What the stage does not draw is refused by name by its own value: a module by
// its `enabled` flag, a setting by a value other than the one the stage draws, an enum by a value it does not draw
// yet. Fields the engine decides with (validation, emission probability, contact, bursts' timing, and `blendMode`,
// ISM's `CompositeMode`: how nested submodules compose, not how particles blend) or the editor keeps (prefab source)
// are the record's and not drawn. A constant mode reads no curve, as in Unity, so a record's curves beside one are
// unread, and so are a mesh beside a billboard and the shape's texture settings beside no texture. The material is the
// owner's to decide; the stage draws a named placeholder (`MODEL_EMITTER_PLACEHOLDER`). emitterValueModel.ts reads
// each value.

// The modules the stage does not draw yet, each refused when enabled.
export const MODEL_EMITTER_UNDRAWN_MODULES = Object.freeze({noiseSettings: FIELDS.noise, colorBySpeed: FIELDS.color,
  rotationOverLifetime: FIELDS.axisCurve, rotationBySpeed: FIELDS.axisCurve,
  textureSheetAnimation: FIELDS.textureSheet});
const START_ROTATION = FIELDS.vector3.map(axis => `startRotation${axis.toUpperCase()}`);
const ONE: ModelEmitterBetween<number> = Object.freeze({min: 1, max: 1});
const WHITE: ModelEmitterRgba = Object.freeze([1, 1, 1, 1]);
const UNTINTED: ModelEmitterBetween<ModelEmitterRgba> = Object.freeze({min: WHITE, max: WHITE});
const AT_REST: ModelVector = Object.freeze([0, 0, 0]);
const STILL: ModelEmitterBetween<ModelVector> = Object.freeze({min: AT_REST, max: AT_REST});
const LINEAR = ['linearX', 'linearY', 'linearZ'] as const;
// Velocity over lifetime's terms the stage holds at zero: orbiting about the emitter, and moving away from it.
const ORBITAL = ['orbitalX', 'orbitalY', 'orbitalZ', 'orbitalOffsetX', 'orbitalOffsetY', 'orbitalOffsetZ',
  'radial'] as const;

function main(value: unknown, where: string) {
  const record = modelRecord(value, FIELDS.main, where);
  drawnFlag(record.startRotation3D, DRAWN_VALUE.off, `${where}.startRotation3D`);
  for (const axis of START_ROTATION) heldAt(record[axis], DRAWN_VALUE.heldAtZero, `${where}.${axis}`);
  drawnOption(record.simulationSpace, MODEL_SIMULATION_SPACE, DRAWN.space, `${where}.simulationSpace`);
  drawnNumber(record.simulationSpeed, DRAWN_VALUE.unscaled, `${where}.simulationSpeed`);
  heldAt(record.gravityModifier, DRAWN_VALUE.heldAtZero, `${where}.gravityModifier`);
  return {looping: modelFlag(record.looping, `${where}.looping`),
    duration: unbounded(record.duration, `${where}.duration`),
    lifetime: curve(record.startLifetime, `${where}.startLifetime`),
    speed: curve(record.startSpeed, `${where}.startSpeed`), size: curve(record.startSize, `${where}.startSize`),
    color: color(record.startColor, `${where}.startColor`),
    maxParticles: modelNumber(record.maxParticles, `${where}.maxParticles`, 1, MODEL_EMITTER_BUDGET.particles)};
}
function rate(value: unknown, where: string) {
  const record = modelRecord(value, FIELDS.emission, where);
  drawnFlag(record.hasBurst, DRAWN_VALUE.off, `${where}.hasBurst`);
  heldAt(record.rateOverDistance, DRAWN_VALUE.heldAtZero, `${where}.rateOverDistance`);
  const {max} = curve(record.rateOverTime, `${where}.rateOverTime`, DRAWN.rate);
  if (max === 0) throw new ModelStageRefusal(refusal.emitsNothing(where));
  return max;
}
// Off, Unity emits from the emitter's centre: a sphere of no radius.
const radius = (value: unknown, where: string) => module(value, FIELDS.shape, where, shape => {
  drawnOption(shape.shapeType, MODEL_SHAPE_TYPE, DRAWN.shape, `${where}.shapeType`);
  drawnNumber(shape.radiusThickness, DRAWN_VALUE.wholeVolume, `${where}.radiusThickness`);
  drawnNumber(shape.arc, DRAWN_VALUE.wholeTurn, `${where}.arc`);
  drawnVector(shape.position, DRAWN_VALUE.centred, `${where}.position`);
  drawnVector(shape.scale, DRAWN_VALUE.unstretched, `${where}.scale`);
  drawnFlag(shape.alignToDirection, DRAWN_VALUE.off, `${where}.alignToDirection`);
  if (shape.texture !== null) throw new ModelStageRefusal(refusal.undrawnAsset(`${where}.texture`));
  return unbounded(shape.radius, `${where}.radius`);
}, 0);
// Unity's velocity over lifetime in its constant modes: each particle moves at its linear velocity, picked per axis, on
// top of its start speed. The stage draws its speed modifier unscaled only.
const velocity = (value: unknown, where: string) => module(value, FIELDS.velocity, where, settings => {
  drawnOption(settings.space, MODEL_SIMULATION_SPACE, DRAWN.velocitySpace, `${where}.space`);
  heldAt(settings.speedModifier, DRAWN_VALUE.unscaled, `${where}.speedModifier`);
  for (const term of ORBITAL) heldAt(settings[term], DRAWN_VALUE.heldAtZero, `${where}.${term}`);
  return axes(settings, LINEAR, where);
}, STILL);

// The built-in mesh a mesh profile names; any other asset is refused by its reference.
function builtinMesh(value: unknown, where: string): ModelEmitterMesh {
  const {guid, fileID} = modelRecord(value, MODEL_ASSET_REFERENCE_FIELDS, where);
  const {meshes} = MODEL_UNITY_BUILTIN_MESH;
  const named = guid === MODEL_UNITY_BUILTIN_MESH.guid ? meshes.find(builtin => builtin.fileID === fileID) : undefined;
  if (!named) {
    throw new ModelStageRefusal(refusal.undrawnMesh(where, String(guid), String(fileID), meshes.map(({mesh}) => mesh)));
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
  return Object.freeze({
    particle: particle(record, where),
    origin: modelOption(record.emitterOrigin, MODEL_EMITTER_ORIGIN, `${where}.emitterOrigin`),
    ...main(record.mainSettings, `${where}.mainSettings`),
    rate: rate(record.emissionSettings, `${where}.emissionSettings`),
    radius: radius(record.shapeSettings, `${where}.shapeSettings`),
    velocity: velocity(record.velocitySettings, `${where}.velocitySettings`),
    sizeScale: module(record.sizeOverLifetime, FIELDS.axisCurve, `${where}.sizeOverLifetime`, size => {
      drawnFlag(size.separateAxes, DRAWN_VALUE.off, `${where}.sizeOverLifetime.separateAxes`);
      return curve(size.x, `${where}.sizeOverLifetime.x`);
    }, ONE),
    tint: module(record.colorOverLifetime, FIELDS.color, `${where}.colorOverLifetime`,
      tint => gradient(tint.color, `${where}.colorOverLifetime.color`), UNTINTED),
  });
}
const byId = <T>(value: unknown, where: string, read: (record: unknown, where: string) => T) =>
  Object.freeze(Object.fromEntries(modelEntries(value, where, 'emitter profiles by id')
    .map(([id, record]) => [id, read(record, `${where}.${id}`)])));
// The description's form: each record checked whole by drawing its profile, then kept as stated, so a description
// read again reads as itself.
function record(value: unknown, where: string): ModelEmitterRecord {
  modelEmitterProfile(value, where);
  return modelStatedRecord(value, where);
}
/** An actor's records, by the id the engine's frame names them by, as the description holds them. */
export const modelEmitterRecords = (value: unknown, where: string): ModelEmitterRecords => byId(value, where, record);
/** What the stage draws of an actor's records, by the same ids. */
export const modelEmitterProfiles = (value: ModelEmitterRecords, where: string): ModelEmitterProfiles =>
  byId(value, where, modelEmitterProfile);
