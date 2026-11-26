import {modelFlag, modelNumber, modelOption, modelRecord} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_ATTRACTION, MODEL_CURVE_MODE, MODEL_EMITTER_REFUSAL as refusal, MODEL_GRADIENT_MODE, MODEL_RENDER_MODE,
  MODEL_SHADOW_CASTING, MODEL_SHAPE_TYPE, MODEL_SIMULATION_SPACE, type ModelEmitterBetween,
  type ModelEmitterRgba, type ModelEmitterValue} from './emitterModel.ts';
import {MODEL_PARTICLE_FIELDS as FIELDS} from './particleSubmoduleFields.ts';
import type {ModelVector} from './placementModel.ts';

// How one value of the pack's `ParticleSubmodule` record is read against what the stage draws: an option, a flag, a
// number, a curve, a colour or a gradient, each refused by name at a value the stage does not draw yet.
// emitterProfileModel.ts reads the record's modules with these.
export const MODEL_EMITTER_DRAWN = Object.freeze({
  curve: [MODEL_CURVE_MODE.constant, MODEL_CURVE_MODE.twoConstants],
  rate: [MODEL_CURVE_MODE.constant],
  gradient: [MODEL_GRADIENT_MODE.color, MODEL_GRADIENT_MODE.twoColors],
  space: [MODEL_SIMULATION_SPACE.local],
  // The space Unity's velocity over lifetime adds its linear velocity in.
  velocitySpace: [MODEL_SIMULATION_SPACE.local],
  render: [MODEL_RENDER_MODE.billboard, MODEL_RENDER_MODE.mesh],
  shape: [MODEL_SHAPE_TYPE.sphere],
  attraction: [MODEL_ATTRACTION.natural],
  shadow: [MODEL_SHADOW_CASTING.off],
});
const DRAWN = MODEL_EMITTER_DRAWN;
// The one value the stage draws of each setting it does not vary.
export const MODEL_EMITTER_DRAWN_VALUE = Object.freeze({off: false, on: true, heldAtZero: 0, wholeTurn: 360,
  wholeVolume: 1, unscaled: 1, centred: Object.freeze([0, 0, 0]), unstretched: Object.freeze([1, 1, 1])});

function drawn<V extends ModelEmitterValue>(value: V, options: readonly ModelEmitterValue[], where: string): V {
  if (!options.includes(value)) throw new ModelStageRefusal(refusal.undrawn(where, value, options));
  return value;
}
export function drawnOption<O extends number>(value: unknown, options: Readonly<Record<string, O>>,
  drawable: readonly number[], where: string): O {
  return drawn(modelOption(value, options, where), drawable, where);
}
export const drawnFlag = (value: unknown, drawable: boolean, where: string) =>
  drawn(modelFlag(value, where), [drawable], where);
export const unbounded = (value: unknown, where: string) => modelNumber(value, where, 0, Number.POSITIVE_INFINITY);
const signed = (value: unknown, where: string) =>
  modelNumber(value, where, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
export const drawnNumber = (value: unknown, drawable: number, where: string) =>
  drawn(signed(value, where), [drawable], where);
export function drawnVector(value: unknown, drawable: readonly number[], where: string) {
  const record = modelRecord(value, FIELDS.vector3, where);
  FIELDS.vector3.forEach((axis, index) => drawnNumber(record[axis], drawable[index], `${where}.${axis}`));
}
// Unity's constant mode reads m_ConstantMax alone (`MinMaxCurve.constant`); two constants draw between both.
export function curve(value: unknown, where: string, drawable: readonly number[] = DRAWN.curve,
  read = unbounded): ModelEmitterBetween<number> {
  const record = modelRecord(value, FIELDS.minMaxCurve, where);
  const mode = drawnOption(record.m_Mode, MODEL_CURVE_MODE, drawable, `${where}.m_Mode`);
  const max = read(record.m_ConstantMax, `${where}.m_ConstantMax`);
  const min = mode === MODEL_CURVE_MODE.constant ? max : read(record.m_ConstantMin, `${where}.m_ConstantMin`);
  return Object.freeze({min: Math.min(min, max), max: Math.max(min, max)});
}
/** A curve whose value may be below zero, as a velocity's is. */
export const signedCurve = (value: unknown, where: string) => curve(value, where, DRAWN.curve, signed);
/** A curve the stage draws at one value only: a constant of it, or two constants both of it. */
export function heldAt(value: unknown, held: number, where: string) {
  const {min, max} = signedCurve(value, where);
  drawnNumber(max, held, `${where}.m_ConstantMax`);
  drawnNumber(min, held, `${where}.m_ConstantMin`);
}
/** Three curves, one an axis, each read alone: the stage draws each axis between its two constants by its own pick. */
export function axes(record: Record<string, unknown>, fields: readonly [string, string, string],
  where: string): ModelEmitterBetween<ModelVector> {
  const [x, y, z] = fields.map(field => signedCurve(record[field], `${where}.${field}`));
  const min: ModelVector = Object.freeze([x.min, y.min, z.min]);
  const max: ModelVector = Object.freeze([x.max, y.max, z.max]);
  return Object.freeze({min, max});
}
export function color(value: unknown, where: string): ModelEmitterRgba {
  const record = modelRecord(value, FIELDS.rgba, where);
  const at = (channel: string) => unbounded(record[channel], `${where}.${channel}`);
  const [r, g, b, a] = FIELDS.rgba;
  const rgba: ModelEmitterRgba = [at(r), at(g), at(b), at(a)];
  return Object.freeze(rgba);
}
export function gradient(value: unknown, where: string): ModelEmitterBetween<ModelEmitterRgba> {
  const record = modelRecord(value, FIELDS.minMaxGradient, where);
  const mode = drawnOption(record.m_Mode, MODEL_GRADIENT_MODE, DRAWN.gradient, `${where}.m_Mode`);
  const max = color(record.m_ColorMax, `${where}.m_ColorMax`);
  const min = mode === MODEL_GRADIENT_MODE.color ? max : color(record.m_ColorMin, `${where}.m_ColorMin`);
  return Object.freeze({min, max});
}
/** A module with its `enabled` switch: off, it changes nothing, as in Unity. */
export function module<T>(value: unknown, fields: readonly string[], where: string,
  read: (record: Record<string, unknown>) => T, off: T): T {
  const record = modelRecord(value, fields, where);
  return modelFlag(record.enabled, `${where}.enabled`) ? read(record) : off;
}
