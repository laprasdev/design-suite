import {modelEntries, modelFlag, modelNumber, modelOption, modelRecord} from './recordModel.ts';
import {modelStatedRecord} from './statedValueModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_ASSET_REFERENCE_FIELDS, MODEL_ATTRACTION, MODEL_CURVE_MODE, MODEL_EMITTER_BUDGET, MODEL_EMITTER_FORM,
  MODEL_EMITTER_ORIGIN, MODEL_UNITY_BUILTIN_MESH, modelEmitterCapRefusal, modelEmitterOverCap,
  MODEL_EMITTER_REFUSAL as refusal, MODEL_GRADIENT_MODE, MODEL_RENDER_MODE, MODEL_SHADOW_CASTING, MODEL_SHAPE_TYPE,
  MODEL_SIMULATION_SPACE,
  type ModelEmitterMesh, type ModelEmitterParticle, type ModelEmitterProfile,
  type ModelEmitterProfiles, type ModelEmitterRange,
  type ModelEmitterRecord, type ModelEmitterRecords,
  type ModelEmitterRgba, type ModelEmitterValue} from './emitterModel.ts';
import {MODEL_PARTICLE_FIELDS as FIELDS} from './particleSubmoduleFields.ts';

// Reads the pack's whole `ParticleSubmodule` record as ISM's C# serializes it, checked with no renderer. Each struct
// states exactly its serialized fields. What the stage does not draw is refused by name by its own value: a module by
// its `enabled` flag, a setting by a value other than the one the stage draws, an enum by a value it does not draw
// yet. Fields the engine decides with (validation, emission probability, contact, bursts' timing, and `blendMode`,
// ISM's `CompositeMode`: how nested submodules compose, not how particles blend) or the editor keeps (prefab source)
// are the record's and not drawn. A constant mode reads no curve, as in Unity, so a record's curves beside one are
// unread, and so are a mesh beside a billboard and the shape's texture settings beside no texture. The material is the
// owner's to decide; the stage draws a named placeholder (`MODEL_EMITTER_PLACEHOLDER`, emitterSystems.ts).
export const MODEL_EMITTER_DRAWN = Object.freeze({
  curve: [MODEL_CURVE_MODE.constant, MODEL_CURVE_MODE.twoConstants],
  rate: [MODEL_CURVE_MODE.constant],
  // An over-lifetime module draws its constant alone: it multiplies the start value by one number, exactly as a
  // constant start value does. A random factor between two (TwoConstants, TwoColors) is a per-particle draw that
  // quarks' over-life behaviours do not type; no pack record states one.
  overLifetime: [MODEL_CURVE_MODE.constant],
  gradient: [MODEL_GRADIENT_MODE.color],
  space: [MODEL_SIMULATION_SPACE.local],
  render: [MODEL_RENDER_MODE.billboard, MODEL_RENDER_MODE.mesh],
  shape: [MODEL_SHAPE_TYPE.sphere],
  attraction: [MODEL_ATTRACTION.natural],
  shadow: [MODEL_SHADOW_CASTING.off],
});
const DRAWN = MODEL_EMITTER_DRAWN;
// The one value the stage draws of each setting it does not vary.
export const MODEL_EMITTER_DRAWN_VALUE = Object.freeze({off: false, on: true, heldAtZero: 0, wholeTurn: 360,
  wholeVolume: 1, unscaled: 1, centred: Object.freeze([0, 0, 0]), unstretched: Object.freeze([1, 1, 1])});
const DRAWN_VALUE = MODEL_EMITTER_DRAWN_VALUE;
// The modules the stage does not draw yet, each refused when enabled.
export const MODEL_EMITTER_UNDRAWN_MODULES = Object.freeze({velocitySettings: FIELDS.velocity,
  noiseSettings: FIELDS.noise, colorBySpeed: FIELDS.color, rotationOverLifetime: FIELDS.axisCurve,
  rotationBySpeed: FIELDS.axisCurve, textureSheetAnimation: FIELDS.textureSheet});
const START_ROTATION = FIELDS.vector3.map(axis => `startRotation${axis.toUpperCase()}`);
const WHITE: ModelEmitterRgba = Object.freeze([1, 1, 1, 1]);

function drawn<V extends ModelEmitterValue>(value: V, options: readonly ModelEmitterValue[], where: string): V {
  if (!options.includes(value)) throw new ModelStageRefusal(refusal.undrawn(where, value, options));
  return value;
}
function drawnOption<O extends number>(value: unknown, options: Readonly<Record<string, O>>,
  drawable: readonly number[], where: string): O {
  return drawn(modelOption(value, options, where), drawable, where);
}
const drawnFlag = (value: unknown, drawable: boolean, where: string) =>
  drawn(modelFlag(value, where), [drawable], where);
const unbounded = (value: unknown, where: string) => modelNumber(value, where, 0, Number.POSITIVE_INFINITY);
const signed = (value: unknown, where: string) =>
  modelNumber(value, where, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
const drawnNumber = (value: unknown, drawable: number, where: string) => drawn(signed(value, where), [drawable], where);
function drawnVector(value: unknown, drawable: readonly number[], where: string) {
  const record = modelRecord(value, FIELDS.vector3, where);
  FIELDS.vector3.forEach((axis, index) => drawnNumber(record[axis], drawable[index], `${where}.${axis}`));
}
// Unity's constant mode reads m_ConstantMax alone (`MinMaxCurve.constant`); two constants draw between both.
function curve(value: unknown, where: string, drawable: readonly number[] = DRAWN.curve,
  read = unbounded): ModelEmitterRange {
  const record = modelRecord(value, FIELDS.minMaxCurve, where);
  const mode = drawnOption(record.m_Mode, MODEL_CURVE_MODE, drawable, `${where}.m_Mode`);
  const max = read(record.m_ConstantMax, `${where}.m_ConstantMax`);
  const min = mode === MODEL_CURVE_MODE.constant ? max : read(record.m_ConstantMin, `${where}.m_ConstantMin`);
  return Object.freeze({min: Math.min(min, max), max: Math.max(min, max)});
}
// A curve the stage draws at one value only: a constant of it, or two constants both of it.
function heldAtZero(value: unknown, where: string) {
  const {min, max} = curve(value, where, DRAWN.curve, signed);
  drawnNumber(max, DRAWN_VALUE.heldAtZero, `${where}.m_ConstantMax`);
  drawnNumber(min, DRAWN_VALUE.heldAtZero, `${where}.m_ConstantMin`);
}
function color(value: unknown, where: string): ModelEmitterRgba {
  const record = modelRecord(value, FIELDS.rgba, where);
  const at = (channel: string) => unbounded(record[channel], `${where}.${channel}`);
  const [r, g, b, a] = FIELDS.rgba;
  const rgba: ModelEmitterRgba = [at(r), at(g), at(b), at(a)];
  return Object.freeze(rgba);
}
function gradient(value: unknown, where: string): ModelEmitterRgba {
  const record = modelRecord(value, FIELDS.minMaxGradient, where);
  drawnOption(record.m_Mode, MODEL_GRADIENT_MODE, DRAWN.gradient, `${where}.m_Mode`);
  return color(record.m_ColorMax, `${where}.m_ColorMax`);
}
// A module with its `enabled` switch: off, it changes nothing, as in Unity.
function module<T>(value: unknown, fields: readonly string[], where: string,
  read: (record: Record<string, unknown>) => T, off: T): T {
  const record = modelRecord(value, fields, where);
  return modelFlag(record.enabled, `${where}.enabled`) ? read(record) : off;
}

function main(value: unknown, where: string) {
  const record = modelRecord(value, FIELDS.main, where);
  drawnFlag(record.looping, DRAWN_VALUE.on, `${where}.looping`);
  drawnFlag(record.startRotation3D, DRAWN_VALUE.off, `${where}.startRotation3D`);
  for (const axis of START_ROTATION) heldAtZero(record[axis], `${where}.${axis}`);
  drawnOption(record.simulationSpace, MODEL_SIMULATION_SPACE, DRAWN.space, `${where}.simulationSpace`);
  drawnNumber(record.simulationSpeed, DRAWN_VALUE.unscaled, `${where}.simulationSpeed`);
  heldAtZero(record.gravityModifier, `${where}.gravityModifier`);
  return {lifetime: curve(record.startLifetime, `${where}.startLifetime`),
    speed: curve(record.startSpeed, `${where}.startSpeed`), size: curve(record.startSize, `${where}.startSize`),
    color: color(record.startColor, `${where}.startColor`),
    maxParticles: modelNumber(record.maxParticles, `${where}.maxParticles`, 1, MODEL_EMITTER_BUDGET.particles)};
}
function rate(value: unknown, where: string) {
  const record = modelRecord(value, FIELDS.emission, where);
  drawnFlag(record.hasBurst, DRAWN_VALUE.off, `${where}.hasBurst`);
  heldAtZero(record.rateOverDistance, `${where}.rateOverDistance`);
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
  const profile: ModelEmitterProfile = Object.freeze({
    particle: particle(record, where),
    origin: modelOption(record.emitterOrigin, MODEL_EMITTER_ORIGIN, `${where}.emitterOrigin`),
    ...main(record.mainSettings, `${where}.mainSettings`),
    rate: rate(record.emissionSettings, `${where}.emissionSettings`),
    radius: radius(record.shapeSettings, `${where}.shapeSettings`),
    sizeScale: module(record.sizeOverLifetime, FIELDS.axisCurve, `${where}.sizeOverLifetime`, size => {
      drawnFlag(size.separateAxes, DRAWN_VALUE.off, `${where}.sizeOverLifetime.separateAxes`);
      return curve(size.x, `${where}.sizeOverLifetime.x`, DRAWN.overLifetime).max;
    }, 1),
    tint: module(record.colorOverLifetime, FIELDS.color, `${where}.colorOverLifetime`,
      tint => gradient(tint.color, `${where}.colorOverLifetime.color`), WHITE),
  });
  if (modelEmitterOverCap(profile, profile.rate)) throw modelEmitterCapRefusal(where, profile, profile.rate);
  return profile;
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
