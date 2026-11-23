import {modelColorOfHex, type ModelColor} from './colorModel.ts';
import {MODEL_STAGE_CURVE, modelStageLook, type ModelStageLook} from './lookModel.ts';
import type {ModelVector} from './placementModel.ts';
import {MODEL_STAGE_BUILT_IN_TIMES, type ModelStageBuiltInTime, type ModelStageThemeColors, type ModelStageTime}
  from './lightingModel.ts';
import {modelToneCurveSource} from './toneCurve.ts';

// The stage as it has always drawn: one key light from this direction and one hemisphere ambient, at these strengths,
// under the one curve at exposure 1, to one far plane. Dark is a night stage of its own: a deep colour behind, a floor
// that still reads under less light, both lights cooled and held to one share of Light's strength, and the unlit aids
// held to another, so a model's emission carries the picture. Exposure is untouched, or the glow would dim with the
// lights.
const STAGE = Object.freeze({
  light: Object.freeze({key: 3, ambient: 2, direction: Object.freeze([3, 5, 4]) as ModelVector}),
  curve: Object.freeze({curve: MODEL_STAGE_CURVE.acesFilmic, exposure: 1}), farPlane: 100,
});
const DARK = Object.freeze({deep: '#05080f', floor: '#262a33', light: '#99bfff', lightShare: 0.3, aidShare: 0.3});

/**
 * The built-in times as data. Light is the consumer's theme: its stage colour behind, its text colour in both lights,
 * its surface colour on the ground and the floor. Each built-in's shadow is its own stated value, the colour its
 * ambient gives the ground; that is what these two times state, not a rule that derives any time's shadow.
 * The backdrop passes through a look's tone curve like everything the look colours, so each built-in states as its
 * backdrop the colour its curve draws as the one it shows behind (the theme's stage colour, Dark's deep colour), which
 * the canvas showed before the backdrop was curved: the same pixels (toneCurve.ts). A theme whose stage colour the
 * curve cannot show is refused by name before anything is built.
 */
export function modelStageBuiltInTimes(colors: ModelStageThemeColors): readonly ModelStageTime[] {
  const theme = (name: keyof ModelStageThemeColors) => modelColorOfHex(colors[name], `The stage theme's ${name}`);
  const [stage, text, surface] = [theme('stage'), theme('text'), theme('surface')];
  const [deep, floor, light] = [DARK.deep, DARK.floor, DARK.light].map(hex => modelColorOfHex(hex, 'Dark'));
  const behind = (id: ModelStageBuiltInTime, shown: ModelColor) =>
    modelToneCurveSource(STAGE.curve, shown, `Time ${id}: look.backdrop`);
  const looks: Record<ModelStageBuiltInTime, ModelStageLook> = {
    light: {backdrop: behind('light', stage), key: {color: text, strength: STAGE.light.key,
      direction: STAGE.light.direction}, ambient: {sky: text, ground: surface, strength: STAGE.light.ambient},
    shadow: surface, night: 0, aids: {floor: surface, share: 1}, fog: null, toneCurve: STAGE.curve, glow: null,
    farPlane: STAGE.farPlane},
    dark: {backdrop: behind('dark', deep), ambient: {sky: light, ground: deep,
      strength: STAGE.light.ambient * DARK.lightShare}, key: {color: light, strength: STAGE.light.key * DARK.lightShare,
      direction: STAGE.light.direction}, shadow: deep, night: 1, aids: {floor, share: DARK.aidShare}, fog: null,
    toneCurve: STAGE.curve, glow: null, farPlane: STAGE.farPlane},
  };
  return Object.freeze(MODEL_STAGE_BUILT_IN_TIMES.map(({id, label}) =>
    Object.freeze({id, label, look: modelStageLook(looks[id], `Time ${id}: look`)})));
}
