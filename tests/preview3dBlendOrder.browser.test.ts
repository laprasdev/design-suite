// A blended surface in front of the stage's aids mixes over them in linear light: the frame draws the aids in its one
// pass with the scene (draw.ts), so three sorts the blended sheet over the floor. Measured in headless Chromium
// through the stage's draw and kind materials.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openScene, SCENE_GL} from './browserScene.ts';
import {FRAME_PIXEL} from './framePixels.ts';
import {BLEND_ORDER_SCENE_ENTRY, BLEND_ORDER_VIEWPORT, FLOOR_COLOR, SHEET_ALPHA, SHEET_COLOR}
  from './preview3dBlendOrderCases.ts';

// A half float holds each colour within a byte of its 8-bit rounding.
const BYTE_TOLERANCE = 1;
const {stride: STRIDE, colorChannels: CHANNELS} = FRAME_PIXEL;
const bytes = (linear: readonly number[]) => linear.map(value => Math.round(value * 255));
const blended = FLOOR_COLOR.map((floor, channel) => SHEET_COLOR[channel] * SHEET_ALPHA + floor * (1 - SHEET_ALPHA));

const page = await openScene(BLEND_ORDER_SCENE_ENTRY, BLEND_ORDER_VIEWPORT, SCENE_GL.software);
const {pixels} = await page.evaluate(() => window.drawBlendOrder());
// The pixel's colour at a column of the frame's middle row.
const at = (column: number) => {
  const start = (Math.floor(BLEND_ORDER_VIEWPORT.height / 2) * BLEND_ORDER_VIEWPORT.width + column) * STRIDE;
  return pixels.slice(start, start + CHANNELS);
};
const assertNear = (actual: readonly number[], expected: readonly number[], label: string) => assert.ok(
  actual.every((byte, channel) => Math.abs(byte - expected[channel]) <= BYTE_TOLERANCE),
  `${label}: [${actual.join(', ')}] differs from [${expected.join(', ')}] beyond ±${BYTE_TOLERANCE}`);

test('a blended sheet in front of the floor aid mixes over it at its alpha, in linear light', () => {
  assertNear(at(BLEND_ORDER_VIEWPORT.width / 4), bytes(blended), 'the sheet over the floor');
  assertNear(at(BLEND_ORDER_VIEWPORT.width * 3 / 4), bytes(FLOOR_COLOR), 'the floor alone');
});
