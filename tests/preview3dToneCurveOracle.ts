// What the canvas shows for a linear colour under a look's tone curve, computed forwards as three r180's GLSL does it
// (ShaderChunk/tonemapping_pars_fragment.glsl.js ACESFilmicToneMapping at exposure 1, then the sRGB encoding), and
// written to 8 bits. A test oracle only: the stage runs the curve on the GPU and its inverse in toneCurve.ts, so this
// independent forward copy is what checks that inverse.
import * as THREE from 'three';

const fit = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
function aces([r, g, b]: readonly number[]) {
  const [x, y, z] = [r / 0.6, g / 0.6, b / 0.6];
  const v = [0.59719 * x + 0.35458 * y + 0.04823 * z, 0.07600 * x + 0.90834 * y + 0.01566 * z,
    0.02840 * x + 0.13383 * y + 0.83777 * z].map(fit);
  return [1.60475 * v[0] - 0.53108 * v[1] - 0.07367 * v[2], -0.10208 * v[0] + 1.10813 * v[1] - 0.00605 * v[2],
    -0.00327 * v[0] - 0.07276 * v[1] + 1.07602 * v[2]].map(channel => Math.min(1, Math.max(0, channel)));
}
/** The bytes the canvas holds for a linear colour drawn under `curve` ('aces-filmic', or null for none). */
export function shownBytes(linear: readonly number[], curve: string | null) {
  const [r, g, b] = curve === null ? linear : aces(linear);
  const encoded = new THREE.Color(r, g, b).getRGB({r: 0, g: 0, b: 0}, THREE.SRGBColorSpace);
  return [encoded.r, encoded.g, encoded.b].map(channel => Math.round(channel * 255));
}
/** The bytes of an sRGB colour as stated. */
export const statedBytes = (srgb: readonly number[]) => srgb.map(channel => Math.round(channel * 255));
