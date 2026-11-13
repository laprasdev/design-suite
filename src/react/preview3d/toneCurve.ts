import * as THREE from 'three';
import type {ModelColor} from './colorModel.ts';
import {MODEL_STAGE_TONE_CURVE, type ModelStageToneCurve} from './lookModel.ts';
import {ModelStageRefusal} from './refusal.ts';

// A look's tone curve run backwards: the colour a look states so that its curve draws a colour it must show, as the
// built-in times state their backdrop (builtInTimes.ts). Each curve is three r180's own, drawn on the GPU by its
// <tonemapping_fragment> (ShaderChunk/tonemapping_pars_fragment.glsl.js); its constants are restated here, the numbers
// three's GLSL holds, because its inverse is solved on the CPU, and the stage never sets an exposure, so three's is 1.
// ACES filmic, its matrices written row by row (three's GLSL states them column by column):
//   shown = clamp( OUTPUT · fit( INPUT · colour / 0.6 ), 0, 1 ),   fit(v) = ( v (v + a) - b ) / ( v (c v + d) + e )
// fit rises over v >= 0, so a channel r it gives back is the positive root of (1 - c r) v² + (a - d r) v - (b + e r).
const ACES = Object.freeze({
  input: [0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777],
  output: [1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602],
  fit: Object.freeze({a: 0.0245786, b: 0.000090537, c: 0.983729, d: 0.4329510, e: 0.238081}), exposure: 0.6,
});
const inverse = (rows: readonly number[]) => new THREE.Matrix3().set(...(rows as [number, number, number, number,
  number, number, number, number, number])).invert();
const ACES_BACK = Object.freeze({output: inverse(ACES.output), input: inverse(ACES.input)});
function fitBack(r: number) {
  const {a, b, c, d, e} = ACES.fit, square = 1 - c * r, linear = a - d * r, constant = -(b + e * r);
  return (-linear + Math.sqrt(linear * linear - 4 * square * constant)) / (2 * square);
}
const BACKWARDS: Readonly<Record<ModelStageToneCurve, (light: THREE.Vector3) => THREE.Vector3>> = Object.freeze({
  [MODEL_STAGE_TONE_CURVE.acesFilmic]: light => {
    light.applyMatrix3(ACES_BACK.output);
    return light.set(fitBack(light.x), fitBack(light.y), fitBack(light.z)).applyMatrix3(ACES_BACK.input)
      .multiplyScalar(ACES.exposure);
  },
});
export const MODEL_TONE_CURVE_TEXT = Object.freeze({
  unreachable: (where: string, curve: string, shown: ModelColor) => `${where}: the ${curve} curve draws no colour ` +
    `within [0, 1] as [${shown.join(', ')}]; a look states one it can show.`,
});
const unit = (channel: number) => channel >= 0 && channel <= 1;

/** The sRGB colour, within [0, 1], that the curve draws as `shown`; refused, naming `where`, when there is none. */
export function modelToneCurveSource(curve: ModelStageToneCurve, shown: ModelColor, where: string): ModelColor {
  const linear = new THREE.Color().setRGB(shown[0], shown[1], shown[2], THREE.SRGBColorSpace);
  const back = BACKWARDS[curve](new THREE.Vector3(linear.r, linear.g, linear.b));
  const source = new THREE.Color(back.x, back.y, back.z).getRGB({r: 0, g: 0, b: 0}, THREE.SRGBColorSpace);
  const channels = [source.r, source.g, source.b] as const;
  if (!channels.every(unit)) throw new ModelStageRefusal(MODEL_TONE_CURVE_TEXT.unreachable(where, curve, shown));
  return Object.freeze(channels);
}
