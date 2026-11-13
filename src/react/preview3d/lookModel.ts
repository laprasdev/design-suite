import {modelColor, type ModelColor} from './colorModel.ts';
import {modelPresentationVector, type ModelVector} from './placementModel.ts';
import {modelNumber, modelRecord} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';

/** What one time of day gives the stage, every value stated; no renderer type, so any host can apply it. */
export interface ModelStageLook {
  /** The colour behind everything the stage draws. */
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
  /** The time's glow, or null for none: what is brighter than the threshold blooms (draw.ts). */
  readonly glow: ModelStageGlow | null;
}
/**
 * Glow: the linear luminance above which a pixel blooms, before tone mapping; how strongly the bloom is added back; and
 * how far it spreads, from 0 (tight) up. Whether a threshold blooms lit surfaces is a judgement about a picture.
 */
export interface ModelStageGlow {readonly threshold: number; readonly strength: number; readonly radius: number}
/** Fog by distance from the camera, from a near colour to a far one, and a height layer below a level, or null. */
export interface ModelStageFog {
  readonly near: {readonly distance: number; readonly color: ModelColor};
  readonly far: {readonly distance: number; readonly color: ModelColor};
  readonly height: {readonly base: number; readonly top: number; readonly strength: number} | null;
}
export const MODEL_STAGE_LOOK_FIELDS = Object.freeze({
  look: ['backdrop', 'key', 'ambient', 'shadow', 'night', 'aids', 'fog', 'glow'],
  key: ['color', 'strength', 'direction'], ambient: ['sky', 'ground', 'strength'], aids: ['floor', 'share'],
  fog: ['near', 'far', 'height'], reach: ['distance', 'color'], height: ['base', 'top', 'strength'],
  glow: ['threshold', 'strength', 'radius'],
} as const);
export const MODEL_STAGE_FOG_REFUSAL = Object.freeze({
  near: (where: string) => `${where}.near.distance must be greater than 0.`,
  far: (where: string) => `${where}.far.distance must be greater than its near distance.`,
  top: (where: string) => `${where}.top must be above its base.`,
});
const fields = MODEL_STAGE_LOOK_FIELDS, UNBOUNDED = Number.POSITIVE_INFINITY;

function direction(value: unknown, where: string): ModelVector {
  const vector = modelPresentationVector(value, where);
  if (!(Math.hypot(...vector) > 0)) throw new ModelStageRefusal(`${where} must have a length.`);
  return vector;
}

function reach(value: unknown, where: string) {
  const record = modelRecord(value, fields.reach, where);
  return Object.freeze({distance: modelNumber(record.distance, `${where}.distance`, 0, UNBOUNDED),
    color: modelColor(record.color, `${where}.color`)});
}
function height(value: unknown, where: string) {
  const record = modelRecord(value, fields.height, where);
  const base = modelNumber(record.base, `${where}.base`, -UNBOUNDED, UNBOUNDED);
  const top = modelNumber(record.top, `${where}.top`, -UNBOUNDED, UNBOUNDED);
  if (!(top > base)) throw new ModelStageRefusal(MODEL_STAGE_FOG_REFUSAL.top(where));
  return Object.freeze({base, top, strength: modelNumber(record.strength, `${where}.strength`, 0, 1)});
}
// Null is the explicit "no fog" and "no height layer", as `environment: null` is; nothing missing is read as either.
function fog(value: unknown, where: string): ModelStageFog | null {
  if (value === null) return null;
  const record = modelRecord(value, fields.fog, where);
  const near = reach(record.near, `${where}.near`), far = reach(record.far, `${where}.far`);
  if (!(near.distance > 0)) throw new ModelStageRefusal(MODEL_STAGE_FOG_REFUSAL.near(where));
  if (!(far.distance > near.distance)) throw new ModelStageRefusal(MODEL_STAGE_FOG_REFUSAL.far(where));
  return Object.freeze({near, far,
    height: record.height === null ? null : height(record.height, `${where}.height`)});
}
// Glow refuses only what is not a glow at all: a value that is not finite, or below 0.
function glow(value: unknown, where: string): ModelStageGlow | null {
  if (value === null) return null;
  const record = modelRecord(value, fields.glow, where);
  const [threshold, strength, radius] = fields.glow.map(name =>
    modelNumber(record[name], `${where}.${name}`, 0, UNBOUNDED));
  return Object.freeze({threshold, strength, radius});
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
    glow: glow(look.glow, `${where}.glow`),
  });
}
