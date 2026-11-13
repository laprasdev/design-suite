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
}
export const MODEL_STAGE_LOOK_FIELDS = Object.freeze({
  look: ['backdrop', 'key', 'ambient', 'shadow', 'night', 'aids'],
  key: ['color', 'strength', 'direction'], ambient: ['sky', 'ground', 'strength'], aids: ['floor', 'share'],
} as const);
const fields = MODEL_STAGE_LOOK_FIELDS, UNBOUNDED = Number.POSITIVE_INFINITY;

function direction(value: unknown, where: string): ModelVector {
  const vector = modelPresentationVector(value, where);
  if (!(Math.hypot(...vector) > 0)) throw new ModelStageRefusal(`${where} must have a length.`);
  return vector;
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
  });
}
