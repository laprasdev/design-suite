// What preview3dBlendOrder.browser.test.ts and its scene share: the stage's floor aid filling the frame, and a sheet
// drawn by an unlit kind blended at half alpha over its left half, both in linear colours.
import type {ModelColor} from '../src/react/preview3d/model.ts';
import type {FramePixels} from './pixelReadScene.tsx';

export const BLEND_ORDER_SCENE_ENTRY = 'tests/preview3dBlendOrderScene.tsx';
export const BLEND_ORDER_VIEWPORT = Object.freeze({width: 32, height: 32});
export const FLOOR_COLOR: ModelColor = Object.freeze([0.8, 0.2, 0.1]);
export const SHEET_COLOR: ModelColor = Object.freeze([0.1, 0.3, 0.9]);
export const SHEET_ALPHA = 0.5;
export const BLEND_ORDER_PROGRAM = `void kindSurface( inout vec4 diffuse, inout vec3 emissive ) {
  diffuse = surfaceParameter_Color();
}`;
export const BLENDED_SHEET_KIND = Object.freeze({id: 'test-blended-sheet',
  parameters: {_Color: {type: 'color', space: 'linear', hdr: false}}, inert: {}, attributes: ['uv'], light: 'unlit',
  coverage: {blend: 'alpha'}, side: 'front', fog: false, displacement: null,
  webProgram: {path: '/blended-sheet.glsl', sha256: 'f'.repeat(64)}});
export const blendedSheetRecord = () => ({kind: BLENDED_SHEET_KIND.id,
  values: {_Color: {color: [...SHEET_COLOR, SHEET_ALPHA]}}});

declare global {
  interface Window {
    drawBlendOrder(): Promise<FramePixels>;
  }
}
