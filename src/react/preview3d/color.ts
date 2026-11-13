import * as THREE from 'three';
import {MODEL_COLOR_SPACE, type ModelColorSpace} from './surfaceKindModel.ts';

/**
 * The one writer of a colour the stage is given into a three.js colour: every colour a description, a look or an engine
 * frame states is sRGB (colorModel.ts), and three holds colours in its linear working space, so the first three
 * channels are converted on the way in. An alpha after them is the caller's.
 */
export const writeModelColor = (target: THREE.Color, value: readonly [number, number, number, ...number[]]) =>
  target.setRGB(value[0], value[1], value[2], THREE.SRGBColorSpace);

const decoded = new THREE.Color();
/**
 * A surface parameter's colour into four floats of a kind's values, in three's working space: the one rule for a
 * record's colour and an engine's. A colour declared `srgb` is decoded per channel (HDR channels above 1 included, by
 * the same curve), one declared `linear` is used as stored, and alpha is carried as stated.
 */
export function writeModelSurfaceColor(target: Float32Array, at: number,
  value: readonly [number, number, number, number], space: ModelColorSpace) {
  if (space === MODEL_COLOR_SPACE.srgb) writeModelColor(decoded, value).toArray(target, at);
  else for (let channel = 0; channel < 3; channel++) target[at + channel] = value[channel];
  target[at + 3] = value[3];
}
