import {modelColorOfHex} from './colorModel.ts';
import {MODEL_STAGE_TONE_CURVE, modelStageLook, type ModelStageLook} from './lookModel.ts';
import type {ModelVector} from './placementModel.ts';
import {modelName, modelRecord} from './recordModel.ts';
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
  taken: (where: string, value: string, owner: string) => `${where} ${value} is already ${owner}'s.`,
  unknown: (id: string, known: readonly string[]) =>
    `The lighting.time names ${id}; the times are ${known.join(', ')}.`,
});
const refusal = MODEL_STAGE_LIGHTING_REFUSAL;

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
      aids: {floor: surface, share: 1}, fog: null, toneCurve: MODEL_STAGE_TONE_CURVE.acesFilmic, glow: null},
    dark: {backdrop, ambient: {sky: light, ground: backdrop, strength: STAGE_LIGHT.ambient * DARK.lightShare},
      key: {color: light, strength: STAGE_LIGHT.key * DARK.lightShare, direction: STAGE_LIGHT.direction},
      shadow: backdrop, night: 1, aids: {floor, share: DARK.aidShare}, fog: null,
      toneCurve: MODEL_STAGE_TONE_CURVE.acesFilmic, glow: null},
  };
  return Object.freeze(MODEL_STAGE_BUILT_IN_TIMES.map(({id, label}) =>
    Object.freeze({id, label, look: modelStageLook(looks[id], `Time ${id}: look`)})));
}

// Each time's id and label are its own: the Lighting control shows the labels side by side, so a label used twice
// would be two segments no one can tell apart. Every name starts out held by the built-in time that has it.
function holder(field: 'id' | 'label') {
  const held = new Map<string, string>(MODEL_STAGE_BUILT_IN_TIMES.map(time =>
    [time[field], `the built-in time ${time.id}`]));
  return (value: unknown, where: string, owner: string) => {
    const name = modelName(value, where);
    const earlier = held.get(name);
    if (earlier !== undefined) throw new ModelStageRefusal(refusal.taken(where, name, earlier));
    held.set(name, owner);
    return name;
  };
}

/** The lighting part, checked whole: its own times, and a time in force that names one of them or a built-in. */
export function modelStageLighting(value: unknown): ModelStageLighting {
  const lighting = modelRecord(value, MODEL_STAGE_LIGHTING_FIELDS.lighting, 'The lighting');
  if (!Array.isArray(lighting.times)) throw new ModelStageRefusal(refusal.times);
  const [ids, labels] = [holder('id'), holder('label')];
  const times = Object.freeze(Array.from(lighting.times, (entry: unknown, index) => {
    const time = modelRecord(entry, MODEL_STAGE_LIGHTING_FIELDS.time, `Time ${index}`);
    const id = ids(time.id, `Time ${index}.id`, `time ${index}`);
    const label = labels(time.label, `Time ${index}.label`, `time ${id}`);
    return Object.freeze({id, label, look: modelStageLook(time.look, `Time ${id}: look`)});
  }));
  const time = modelName(lighting.time, 'The lighting.time');
  modelStageTimeInForce(time, [...MODEL_STAGE_BUILT_IN_TIMES, ...times]);
  return Object.freeze({time, times});
}

/** The time in force among these, found by its id alone: the one place a time that names nothing is refused. */
export function modelStageTimeInForce<Time extends {readonly id: string}>(id: string, times: readonly Time[]): Time {
  const time = times.find(candidate => candidate.id === id);
  if (!time) throw new ModelStageRefusal(refusal.unknown(id, times.map(candidate => candidate.id)));
  return time;
}

/** The view's Lighting options: the built-in times, then the description's own, each with its label. */
export const modelStageTimeOptions = (value: ModelStageLighting) =>
  [...MODEL_STAGE_BUILT_IN_TIMES, ...value.times].map(({id, label}) => ({value: id, label}));
