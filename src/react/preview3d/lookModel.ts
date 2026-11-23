import {modelColor, type ModelColor} from './colorModel.ts';
import {modelPresentationVector, type ModelVector} from './placementModel.ts';
import {modelNumber, modelOption, modelRecord} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';
import {MODEL_STAGE_NEAR_PLANE} from './presentation.ts';

/** What one time of day gives the stage, every value stated; no renderer type, so any host can apply it. */
export interface ModelStageLook {
  /** The colour behind everything the stage draws, passed through the look's tone curve as every colour it gives. */
  readonly backdrop: ModelColor;
  /** The key light: its colour, its strength, and the direction from the scene toward it, in stage space. */
  readonly key: {readonly color: ModelColor; readonly strength: number; readonly direction: ModelVector};
  /** The ambient: the colour from the sky, the colour from the ground, and its strength. */
  readonly ambient: {readonly sky: ModelColor; readonly ground: ModelColor; readonly strength: number};
  /** The time's shadow colour, for material kinds that take one; nothing the stage draws itself reads it. */
  readonly shadow: ModelColor;
  /** Where the time sits between day (0) and night (1), for material kinds with night terms. */
  readonly night: number;
  /** The stage's own aids: the lit floor's colour, and the share of their authored colour the unlit aids keep. */
  readonly aids: {readonly floor: ModelColor; readonly share: number};
  /** The time's fog, or null for none. How its fields combine is the stage's rule, stated once in fog.ts. */
  readonly fog: ModelStageFog | null;
  /** The curve that maps the frame's light to the screen and the exposure it is drawn under, or null for none:
   * colours come out as stated. */
  readonly toneCurve: ModelStageToneCurve | null;
  /** The time's glow, or null for none: what is brighter than the threshold blooms (draw.ts). */
  readonly glow: ModelStageGlow | null;
  /** How far from the camera the stage draws, beyond its near plane; a fit framed further off reaches further. */
  readonly farPlane: number;
}
/** What the canvas's output takes from a look: its tone curve and its glow (draw.ts). */
export type ModelStageOutput = Pick<ModelStageLook, 'toneCurve' | 'glow'>;
/** The curves the stage can draw: the one it has always used. */
export const MODEL_STAGE_CURVE = Object.freeze({acesFilmic: 'aces-filmic'} as const);
export type ModelStageCurve = typeof MODEL_STAGE_CURVE[keyof typeof MODEL_STAGE_CURVE];
/** A look's tone curve: which curve, and the exposure, greater than 0, the frame's light is scaled by before it; 1
 * draws the light as lit. Exposure belongs to the curve because three scales light only under one. */
export interface ModelStageToneCurve {readonly curve: ModelStageCurve; readonly exposure: number}
/**
 * Glow: the linear luminance above which a pixel blooms; how strongly the bloom is added back; and how far it spreads,
 * from 0 (tight) to 1 (wide). The spread is the bloom's mix between its tight and wide weightings of its five blur
 * levels (three's UnrealBloomPass), meaningful only from 0 to 1: past 1.25 its tightest weight turns negative and the
 * bloom subtracts light. A wider spread is a different bloom, not a larger number. Whether a threshold blooms lit
 * surfaces is a judgement about a picture.
 */
export interface ModelStageGlow {readonly threshold: number; readonly strength: number; readonly radius: number}
/** Fog by distance from the camera, from a near colour to a far one, and a height layer below a level, or null. */
export interface ModelStageFog {
  readonly near: {readonly distance: number; readonly color: ModelColor};
  readonly far: {readonly distance: number; readonly color: ModelColor};
  readonly height: {readonly base: number; readonly top: number; readonly strength: number} | null;
}
export const MODEL_STAGE_LOOK_FIELDS = Object.freeze({
  look: ['backdrop', 'key', 'ambient', 'shadow', 'night', 'aids', 'fog', 'toneCurve', 'glow', 'farPlane'],
  key: ['color', 'strength', 'direction'], ambient: ['sky', 'ground', 'strength'], aids: ['floor', 'share'],
  fog: ['near', 'far', 'height'], reach: ['distance', 'color'], height: ['base', 'top', 'strength'],
  glow: ['threshold', 'strength', 'radius'], toneCurve: ['curve', 'exposure'],
} as const);
/** A least value a look's number must be greater than, and how a refusal names it. */
interface ModelStageLeast {readonly value: number; readonly name: string}
/** Every least value a look states a number beyond: fixed ones, and ones set by the number stated before it. */
export const MODEL_STAGE_LEAST = Object.freeze({
  nothing: Object.freeze({value: 0, name: '0'}),
  nearPlane: Object.freeze({value: MODEL_STAGE_NEAR_PLANE, name: `the stage's near plane, ${MODEL_STAGE_NEAR_PLANE}`}),
  base: (value: number): ModelStageLeast => Object.freeze({value, name: 'its base'}),
  nearDistance: (value: number): ModelStageLeast => Object.freeze({value, name: 'its near distance'}),
});
export const MODEL_STAGE_LOOK_REFUSAL = Object.freeze({
  beyond: (where: string, least: string) => `${where} must be a finite number greater than ${least}.`,
});
const fields = MODEL_STAGE_LOOK_FIELDS, least = MODEL_STAGE_LEAST, UNBOUNDED = Number.POSITIVE_INFINITY;
/** The widest spread the bloom mixes to (UnrealBloomPass's radius), the end of the range it is meaningful on. */
export const MODEL_STAGE_GLOW_WIDEST = 1;

function direction(value: unknown, where: string): ModelVector {
  const vector = modelPresentationVector(value, where);
  if (!(Math.hypot(...vector) > 0)) throw new ModelStageRefusal(`${where} must have a length.`);
  return vector;
}

// Beyond a least value, not at it, refused with one message wherever it falls short: an exposure of 0 draws nothing,
// a far plane at the near one draws no depth, and a fog or a height layer that ends where it starts has no extent.
function beyond(value: unknown, where: string, bound: ModelStageLeast): number {
  const number = modelNumber(value, where, -UNBOUNDED, UNBOUNDED);
  if (!(number > bound.value)) throw new ModelStageRefusal(MODEL_STAGE_LOOK_REFUSAL.beyond(where, bound.name));
  return number;
}

function reach(value: unknown, where: string, bound: ModelStageLeast) {
  const record = modelRecord(value, fields.reach, where);
  return Object.freeze({distance: beyond(record.distance, `${where}.distance`, bound),
    color: modelColor(record.color, `${where}.color`)});
}
function height(value: unknown, where: string) {
  const record = modelRecord(value, fields.height, where);
  const base = modelNumber(record.base, `${where}.base`, -UNBOUNDED, UNBOUNDED);
  const top = beyond(record.top, `${where}.top`, least.base(base));
  return Object.freeze({base, top, strength: modelNumber(record.strength, `${where}.strength`, 0, 1)});
}
// Null is the explicit "no fog" and "no height layer", as `environment: null` is; nothing missing is read as either.
function fog(value: unknown, where: string): ModelStageFog | null {
  if (value === null) return null;
  const record = modelRecord(value, fields.fog, where);
  const near = reach(record.near, `${where}.near`, least.nothing);
  const far = reach(record.far, `${where}.far`, least.nearDistance(near.distance));
  return Object.freeze({near, far,
    height: record.height === null ? null : height(record.height, `${where}.height`)});
}
// Glow refuses what is not a glow at all: a threshold or strength that is not finite or is below 0, and a spread
// outside the range the bloom mixes over.
function glow(value: unknown, where: string): ModelStageGlow | null {
  if (value === null) return null;
  const record = modelRecord(value, fields.glow, where);
  return Object.freeze({threshold: modelNumber(record.threshold, `${where}.threshold`, 0, UNBOUNDED),
    strength: modelNumber(record.strength, `${where}.strength`, 0, UNBOUNDED),
    radius: modelNumber(record.radius, `${where}.radius`, 0, MODEL_STAGE_GLOW_WIDEST)});
}

function toneCurve(value: unknown, where: string): ModelStageToneCurve | null {
  if (value === null) return null;
  const record = modelRecord(value, fields.toneCurve, where);
  return Object.freeze({curve: modelOption(record.curve, MODEL_STAGE_CURVE, `${where}.curve`),
    exposure: beyond(record.exposure, `${where}.exposure`, least.nothing)});
}

/** One look, checked whole; `where` names it in every refusal, as `Time dusk: look`. */
export function modelStageLook(value: unknown, where: string): ModelStageLook {
  const look = modelRecord(value, fields.look, where);
  const key = modelRecord(look.key, fields.key, `${where}.key`);
  const ambient = modelRecord(look.ambient, fields.ambient, `${where}.ambient`);
  const aids = modelRecord(look.aids, fields.aids, `${where}.aids`);
  return Object.freeze({
    backdrop: modelColor(look.backdrop, `${where}.backdrop`),
    key: Object.freeze({color: modelColor(key.color, `${where}.key.color`),
      strength: modelNumber(key.strength, `${where}.key.strength`, 0, UNBOUNDED),
      direction: direction(key.direction, `${where}.key.direction`)}),
    ambient: Object.freeze({sky: modelColor(ambient.sky, `${where}.ambient.sky`),
      ground: modelColor(ambient.ground, `${where}.ambient.ground`),
      strength: modelNumber(ambient.strength, `${where}.ambient.strength`, 0, UNBOUNDED)}),
    shadow: modelColor(look.shadow, `${where}.shadow`),
    night: modelNumber(look.night, `${where}.night`, 0, 1),
    aids: Object.freeze({floor: modelColor(aids.floor, `${where}.aids.floor`),
      share: modelNumber(aids.share, `${where}.aids.share`, 0, 1)}),
    fog: fog(look.fog, `${where}.fog`),
    toneCurve: toneCurve(look.toneCurve, `${where}.toneCurve`),
    glow: glow(look.glow, `${where}.glow`),
    farPlane: beyond(look.farPlane, `${where}.farPlane`, least.nearPlane),
  });
}
