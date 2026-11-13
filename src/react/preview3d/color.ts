import * as THREE from 'three';

/**
 * The one writer of a colour the stage is given into a three.js colour: every colour a description, a look or an engine
 * frame states is sRGB (colorModel.ts), and three holds colours in its linear working space, so the first three
 * channels are converted on the way in. An alpha after them is the caller's.
 */
export const writeModelColor = (target: THREE.Color, value: readonly [number, number, number, ...number[]]) =>
  target.setRGB(value[0], value[1], value[2], THREE.SRGBColorSpace);
