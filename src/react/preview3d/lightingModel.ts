import {modelColorOfHex} from './colorModel.ts';
import {modelStageLook, type ModelStageLook} from './lookModel.ts';
import type {ModelVector} from './placementModel.ts';
import {modelRecord} from './recordModel.ts';
import {ModelStageRefusal} from './refusal.ts';

/** A time of day: its id, the label the view shows for it, and its look. */
export interface ModelStageTime {
  readonly id: string;
  readonly label: string;
  readonly look: ModelStageLook;
}
/** The lighting part: the time in force, by id, among the stage's built-in times and the description's own. */
export interface ModelStageLighting {
  readonly time: string;
  readonly times: readonly ModelStageTime[];
}
/** The theme colours the built-in Light time is made of. */
export interface ModelStageThemeColors {readonly stage: string; readonly text: string; readonly surface: string}
export const MODEL_PREVIEW_LIGHTING_TEXT = Object.freeze({label: 'Lighting', light: 'Light', dark: 'Dark'});
export const MODEL_STAGE_TIME = Object.freeze({light: 'light', dark: 'dark'} as const);
type ModelStageBuiltInTime = typeof MODEL_STAGE_TIME[keyof typeof MODEL_STAGE_TIME];
/** The built-in times, by id and label, in the order the view offers them before a description's own. */
export const MODEL_STAGE_BUILT_IN_TIMES = Object.freeze([
  Object.freeze({id: MODEL_STAGE_TIME.light, label: MODEL_PREVIEW_LIGHTING_TEXT.light}),
  Object.freeze({id: MODEL_STAGE_TIME.dark, label: MODEL_PREVIEW_LIGHTING_TEXT.dark}),
]);
/** The consumer's own theme, as the stage has always shown it, with no times of the description's own. */
export const MODEL_STAGE_THEME_LIGHTING: ModelStageLighting = Object.freeze({
  time: MODEL_STAGE_TIME.light, times: Object.freeze([])});
export const MODEL_STAGE_LIGHTING_FIELDS = Object.freeze({lighting: ['time', 'times'], time: ['id', 'label', 'look']});
export const MODEL_STAGE_LIGHTING_REFUSAL = Object.freeze({
  times: 'The lighting states its own times as an array.',
  id: (index: number) => `Time ${index} needs an id and a label.`,
  taken: (id: string) => `Time ${id} is declared twice, or reuses a built-in time's id.`,
  unknown: (id: unknown, known: readonly string[]) =>
    `The lighting names time ${String(id)}; the times are ${known.join(', ')}.`,
});
const refusal = MODEL_STAGE_LIGHTING_REFUSAL;
const named = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

// The stage as it has always been lit: one key light from this direction and one hemisphere ambient, at these
// strengths. Dark is a night stage of its own: a deep backdrop, a floor that still reads under less light, both lights
// cooled and held to one share of Light's strength, and the unlit aids held to another, so a model's emission carries
// the picture. Exposure is untouched, or the glow would dim with the lights.
const STAGE_LIGHT = Object.freeze({key: 3, ambient: 2, direction: Object.freeze([3, 5, 4]) as ModelVector});
const DARK = Object.freeze({backdrop: '#05080f', floor: '#262a33', light: '#99bfff', lightShare: 0.3, aidShare: 0.3});

/**
 * The built-in times as data. Light is the consumer's theme: its stage colour behind, its text colour in both lights,
 * its surface colour on the ground and the floor. Each built-in's shadow is its own stated value, the colour its
 * ambient gives the ground; that is what these two times state, not a rule that derives any time's shadow.
 */
export function modelStageBuiltInTimes(colors: ModelStageThemeColors): readonly ModelStageTime[] {
  const theme = (name: keyof ModelStageThemeColors) => modelColorOfHex(colors[name], `The stage theme's ${name}`);
  const [stage, text, surface] = [theme('stage'), theme('text'), theme('surface')];
  const [backdrop, floor, light] = [DARK.backdrop, DARK.floor, DARK.light].map(hex => modelColorOfHex(hex, 'Dark'));
  const looks: Record<ModelStageBuiltInTime, ModelStageLook> = {
    light: {backdrop: stage, key: {color: text, strength: STAGE_LIGHT.key, direction: STAGE_LIGHT.direction},
      ambient: {sky: text, ground: surface, strength: STAGE_LIGHT.ambient}, shadow: surface, night: 0,
      aids: {floor: surface, share: 1}, fog: null, glow: null},
    dark: {backdrop, ambient: {sky: light, ground: backdrop, strength: STAGE_LIGHT.ambient * DARK.lightShare},
      key: {color: light, strength: STAGE_LIGHT.key * DARK.lightShare, direction: STAGE_LIGHT.direction},
      shadow: backdrop, night: 1, aids: {floor, share: DARK.aidShare}, fog: null, glow: null},
  };
  return Object.freeze(MODEL_STAGE_BUILT_IN_TIMES.map(({id, label}) =>
    Object.freeze({id, label, look: modelStageLook(looks[id], `Time ${id}: look`)})));
}

/** The lighting part, checked whole: its own times, and a time in force that names one of them or a built-in. */
export function modelStageLighting(value: unknown): ModelStageLighting {
  const lighting = modelRecord(value, MODEL_STAGE_LIGHTING_FIELDS.lighting, 'The lighting');
  if (!Array.isArray(lighting.times)) throw new ModelStageRefusal(refusal.times);
  const ids = new Set<string>(MODEL_STAGE_BUILT_IN_TIMES.map(({id}) => id));
  const times = Object.freeze(Array.from(lighting.times, (entry: unknown, index) => {
    const time = modelRecord(entry, MODEL_STAGE_LIGHTING_FIELDS.time, `Time ${index}`);
    if (!named(time.id) || !named(time.label)) throw new ModelStageRefusal(refusal.id(index));
    if (ids.has(time.id)) throw new ModelStageRefusal(refusal.taken(time.id));
    ids.add(time.id);
    return Object.freeze({id: time.id, label: time.label, look: modelStageLook(time.look, `Time ${time.id}: look`)});
  }));
  if (!named(lighting.time) || !ids.has(lighting.time)) {
    throw new ModelStageRefusal(refusal.unknown(lighting.time, [...ids]));
  }
  return Object.freeze({time: lighting.time, times});
}

/** The time in force: one of the stage's built-ins or one of the description's own, found by its id alone. */
export function modelStageTimeInForce(value: ModelStageLighting, builtIn: readonly ModelStageTime[]): ModelStageTime {
  const times = [...builtIn, ...value.times];
  const time = times.find(candidate => candidate.id === value.time);
  if (!time) throw new ModelStageRefusal(refusal.unknown(value.time, times.map(({id}) => id)));
  return time;
}

/** The view's Lighting options: the built-in times, then the description's own, each with its label. */
export const modelStageTimeOptions = (value: ModelStageLighting) =>
  [...MODEL_STAGE_BUILT_IN_TIMES, ...value.times].map(({id, label}) => ({value: id, label}));
