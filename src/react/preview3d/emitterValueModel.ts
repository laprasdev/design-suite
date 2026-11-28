import {modelFlag, modelNumber, modelOption, modelRecord} from './recordModel.ts';
import {ModelStageUndrawn} from './refusal.ts';
import {MODEL_ARC_MODE, MODEL_ATTRACTION, MODEL_CURVE_MODE, MODEL_EMITTER_DRAWN_SHAPES,
  MODEL_EMITTER_REFUSAL as refusal, MODEL_GRADIENT_MODE, MODEL_GRAVITY_SOURCE, MODEL_RENDER_MODE,
  MODEL_SHADOW_CASTING, MODEL_SIMULATION_SPACE, type ModelEmitterRange, type ModelEmitterRgba, type ModelEmitterValue}
  from './emitterModel.ts';
import {MODEL_PARTICLE_FIELDS as FIELDS} from './particleSubmoduleFields.ts';

// The readers of one serialized value of a pack's `ParticleSubmodule` record, and what of each the stage draws: a
// value it does not draw is refused by name (`ModelStageUndrawn`), so its profile is skipped and reported.
export const MODEL_EMITTER_DRAWN = Object.freeze({
  curve: [MODEL_CURVE_MODE.constant, MODEL_CURVE_MODE.twoConstants],
  rate: [MODEL_CURVE_MODE.constant],
  // An over-lifetime module draws its constant alone: it multiplies the start value by one number, exactly as a
  // constant start value does. A random factor between two (TwoConstants, TwoColors) is a per-particle draw that
  // quarks' over-life behaviours do not type; no pack record states one.
  overLifetime: [MODEL_CURVE_MODE.constant],
  // Unity's gravity modifier draws its constant alone: the engine publishes one acceleration a start for it, where
  // Unity's TwoConstants draws a modifier for each particle.
  gravity: [MODEL_CURVE_MODE.constant],
  // Unity's `main.gravitySource` 3D Physics: the machine's scene gravity, which the engine multiplies on each start.
  gravitySource: [MODEL_GRAVITY_SOURCE.physics3D],
  gradient: [MODEL_GRADIENT_MODE.color],
  // Unity's `main.simulationSpace`: Local and World are quarks' `worldSpace` false and true; Custom names a transform
  // the record does not carry.
  space: [MODEL_SIMULATION_SPACE.local, MODEL_SIMULATION_SPACE.world],
  render: [MODEL_RENDER_MODE.billboard, MODEL_RENDER_MODE.mesh],
  // Unity's `shape.shapeType` each quarks shape draws as Unity does (emitterSystems.ts maps them).
  shape: MODEL_EMITTER_DRAWN_SHAPES,
  // Unity's `shape.arcMode` Random, the only way quarks spreads a shape's particles over its arc.
  arcMode: [MODEL_ARC_MODE.random],
  attraction: [MODEL_ATTRACTION.natural],
  shadow: [MODEL_SHADOW_CASTING.off],
});
const DRAWN = MODEL_EMITTER_DRAWN;
// The one value the stage draws of each setting it does not vary.
export const MODEL_EMITTER_DRAWN_VALUE = Object.freeze({off: false, on: true, heldAtZero: 0, unscaled: 1,
  unstretched: Object.freeze([1, 1, 1])});
const DRAWN_VALUE = MODEL_EMITTER_DRAWN_VALUE;

/** `value`, typed as the one of `drawable` it is; any other is refused by name. */
export function modelEmitterDrawn<D extends ModelEmitterValue>(value: ModelEmitterValue, drawable: readonly D[],
  where: string): D {
  const drawn = drawable.find(option => option === value);
  if (drawn === undefined) throw new ModelStageUndrawn(where, refusal.undrawn(where, value, drawable));
  return drawn;
}
export function modelEmitterDrawnOption<O extends number, D extends O>(value: unknown,
  options: Readonly<Record<string, O>>, drawable: readonly D[], where: string): D {
  return modelEmitterDrawn(modelOption(value, options, where), drawable, where);
}
export const modelEmitterDrawnFlag = (value: unknown, drawable: boolean, where: string) =>
  modelEmitterDrawn(modelFlag(value, where), [drawable], where);
export const modelEmitterUnbounded = (value: unknown, where: string) =>
  modelNumber(value, where, 0, Number.POSITIVE_INFINITY);
export const modelEmitterSigned = (value: unknown, where: string) =>
  modelNumber(value, where, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
export const modelEmitterDrawnNumber = (value: unknown, drawable: number, where: string) =>
  modelEmitterDrawn(modelEmitterSigned(value, where), [drawable], where);
/** A Vector3 record, its axes in order. */
export function modelEmitterVector(value: unknown, where: string): readonly [number, number, number] {
  const record = modelRecord(value, FIELDS.vector3, where);
  const [x, y, z] = FIELDS.vector3.map(axis => modelEmitterSigned(record[axis], `${where}.${axis}`));
  return Object.freeze([x, y, z]);
}
export function modelEmitterDrawnVector(value: unknown, drawable: readonly number[], where: string) {
  const record = modelRecord(value, FIELDS.vector3, where);
  FIELDS.vector3.forEach((axis, index) => modelEmitterDrawnNumber(record[axis], drawable[index], `${where}.${axis}`));
}
/** A `MinMaxCurve`: Unity's constant mode reads m_ConstantMax alone (`MinMaxCurve.constant`); two constants draw
 * between both. */
export function modelEmitterCurve(value: unknown, where: string,
  drawable: readonly typeof MODEL_CURVE_MODE[keyof typeof MODEL_CURVE_MODE][] = DRAWN.curve,
  read = modelEmitterUnbounded): ModelEmitterRange {
  const record = modelRecord(value, FIELDS.minMaxCurve, where);
  const mode = modelEmitterDrawnOption(record.m_Mode, MODEL_CURVE_MODE, drawable, `${where}.m_Mode`);
  const max = read(record.m_ConstantMax, `${where}.m_ConstantMax`);
  const min = mode === MODEL_CURVE_MODE.constant ? max : read(record.m_ConstantMin, `${where}.m_ConstantMin`);
  return Object.freeze({min: Math.min(min, max), max: Math.max(min, max)});
}
/** A curve the stage draws at one value only: a constant of it, or two constants both of it. */
export function modelEmitterHeldAtZero(value: unknown, where: string) {
  const {min, max} = modelEmitterCurve(value, where, DRAWN.curve, modelEmitterSigned);
  modelEmitterDrawnNumber(max, DRAWN_VALUE.heldAtZero, `${where}.m_ConstantMax`);
  modelEmitterDrawnNumber(min, DRAWN_VALUE.heldAtZero, `${where}.m_ConstantMin`);
}
export function modelEmitterColor(value: unknown, where: string): ModelEmitterRgba {
  const record = modelRecord(value, FIELDS.rgba, where);
  const at = (channel: string) => modelEmitterUnbounded(record[channel], `${where}.${channel}`);
  const [r, g, b, a] = FIELDS.rgba;
  const rgba: ModelEmitterRgba = [at(r), at(g), at(b), at(a)];
  return Object.freeze(rgba);
}
export function modelEmitterGradient(value: unknown, where: string): ModelEmitterRgba {
  const record = modelRecord(value, FIELDS.minMaxGradient, where);
  modelEmitterDrawnOption(record.m_Mode, MODEL_GRADIENT_MODE, DRAWN.gradient, `${where}.m_Mode`);
  return modelEmitterColor(record.m_ColorMax, `${where}.m_ColorMax`);
}
/** A module with its `enabled` switch: off, it changes nothing, as in Unity. */
export function modelEmitterModule<T>(value: unknown, fields: readonly string[], where: string,
  read: (record: Record<string, unknown>) => T, off: T): T {
  const record = modelRecord(value, fields, where);
  return modelFlag(record.enabled, `${where}.enabled`) ? read(record) : off;
}
