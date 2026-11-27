// What preview3dFlatNormal.browser.test.ts and its scene share: a lit kind that reads its normal map through one of
// Unity's own decoders, over the flat-normal constant its empty slot is given, on a square lit by one oblique light.
import {MODEL_SURFACE_GLSL} from '../src/react/preview3d/surfaceGlsl.ts';
import {MODEL_TEXTURE_CONSTANT} from '../src/react/preview3d/surfaceTextureModel.ts';
import type {FramePixels} from './pixelReadScene.tsx';

export const FLAT_NORMAL_SCENE_ENTRY = 'tests/preview3dFlatNormalScene.tsx';
export const FLAT_NORMAL_VIEWPORT = Object.freeze({width: 32, height: 32});
/** How the kind reads its normal map: not at all, or through one of `UnpackNormalScale`'s branches. */
export const NORMAL_DECODE = Object.freeze({none: 0, rgb: 1, rgOrAg: 2} as const);
export type NormalDecode = (typeof NORMAL_DECODE)[keyof typeof NORMAL_DECODE];

// Unity 6000.3's `UnpackNormalScale` branches (com.unity.render-pipelines.core ShaderLibrary/Packing.hlsl:168-228),
// each as written there at scale 1: `UnpackNormalRGB` under `UNITY_NO_DXT5nm`, and `UnpackNormalMapRGorAG`, the
// default, which folds r into a and reads `UnpackNormalAG`. The `UNITY_ASTC_NORMALMAP_ENCODING` branch reads `ag`
// alone, (1, 0.5) for this texel, x = 1: no texel decodes flat under both it and RGorAG (a = 0.5 against a * r = 0.5).
const UNPACK = Object.freeze([
  {decode: NORMAL_DECODE.rgb, name: 'UnpackNormalRGB', glsl: `vec3 UnpackNormalRGB( vec4 packedNormal ) {
  return packedNormal.rgb * 2.0 - 1.0;
}`},
  {decode: NORMAL_DECODE.rgOrAg, name: 'UnpackNormalMapRGorAG', glsl: `vec3 UnpackNormalAG( vec4 packedNormal ) {
  vec3 normal;
  normal.xy = packedNormal.ag * 2.0 - 1.0;
  normal.z = max( 1.0e-16, sqrt( 1.0 - clamp( dot( normal.xy, normal.xy ), 0.0, 1.0 ) ) );
  return normal;
}
vec3 UnpackNormalMapRGorAG( vec4 packedNormal ) {
  packedNormal.a *= packedNormal.r;
  return UnpackNormalAG( packedNormal );
}`},
]);
/** The decoders the test draws through, each against no normal map. */
export const UNPACKED_DECODES = Object.freeze(UNPACK.map(({decode}) => decode));

const {fromMap, sample, normal} = MODEL_SURFACE_GLSL;
const branch = ({decode, name}: {readonly decode: NormalDecode; readonly name: string}) =>
  `if ( abs( decode - ${decode.toFixed(1)} ) < 0.5 ) ${normal} = ${fromMap}( ${name}( texel ), vUv );`;
export const FLAT_NORMAL_PROGRAM = `${UNPACK.map(({glsl}) => glsl).join('\n')}
void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse.rgb = vec3( 1.0 );
  float decode = surfaceParameter_Decode();
  vec4 texel = ${sample}_BumpMap( vUv );
  ${UNPACK.map(branch).join('\n  ')}
}`;
export const FLAT_NORMAL_KIND = Object.freeze({id: 'test-flat-normal',
  parameters: {_Decode: {type: 'float'}, _BumpMap: {type: 'texture', space: 'linear'}}, inert: {},
  sceneReads: [], attributes: ['uv', 'normal'],
  light: 'standard', coverage: 'opaque', side: 'front', fog: false, displacement: null,
  webProgram: {path: '/flat-normal.glsl', sha256: 'e'.repeat(64)}});
/** The record a decoder draws: the kind's empty normal slot holds the flat-normal constant. */
export const flatNormalRecord = (decode: NormalDecode) => ({kind: FLAT_NORMAL_KIND.id, values: {
  _Decode: {float: decode}, _BumpMap: {texture: {constant: MODEL_TEXTURE_CONSTANT.flatNormal}}}});

declare global {
  interface Window {
    drawFlatNormal(decode: NormalDecode): Promise<FramePixels>;
  }
}
