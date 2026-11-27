// A kind that reads the scene's depth sees, at each pixel, the eye depth of the opaque surface behind it, never a
// blended one between, nor the stage's aids, and through a cut-out's hole what is behind it; and its own eye depth:
// as URP's camera depth texture gives a transparent graph's Scene Depth node and its Screen Position w.
// Measured in headless Chromium through the stage's depth pass and kind program.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openScene, SCENE_GL} from './browserScene.ts';
import {FRAME_PIXEL} from './framePixels.ts';
import {DEPTH_COLUMNS, DEPTH_SCENE_ENTRY, DEPTH_VIEWPORT, depthBytes} from './preview3dSceneDepthCases.ts';

// Two 8-bit steps: a 24-bit depth read back through float32 and one rounding.
const BYTE_TOLERANCE = 2;
const {stride: STRIDE, colorChannels: CHANNELS} = FRAME_PIXEL;
const {width, height} = DEPTH_VIEWPORT;

const page = await openScene(DEPTH_SCENE_ENTRY, DEPTH_VIEWPORT, SCENE_GL.software);
const rgbAt = (pixels: readonly number[], x: number, y: number) =>
  pixels.slice((y * width + x) * STRIDE, (y * width + x) * STRIDE + CHANNELS);

test('the sheet shows the opaque and cut-out surfaces\' eye depth behind it, not the veil\'s or an aid\'s, and its own',
  async () => {
  const {pixels, shadowsUpdate, colourMask, programs} = await page.evaluate(() => window.drawSceneDepth());
  assert.deepEqual([shadowsUpdate, colourMask], [true, [true, true, true, true]], 'the depth pass restores the state');
  assert.equal(programs[1], programs[0], 'a second frame compiles no program');
  const rows = [0.25, 0.5, 0.75].map(at => Math.floor(at * height));
  for (const [across, behind] of DEPTH_COLUMNS) {
    const x = Math.floor(width * across);
    for (const y of rows) {
      const actual = rgbAt(pixels, x, y), expected = depthBytes(behind);
      assert.ok(actual.every((byte, channel) => Math.abs(byte - expected[channel]) <= BYTE_TOLERANCE),
        `at ${x}, ${y}: [${actual.join(', ')}] differs from [${expected.join(', ')}] beyond ±${BYTE_TOLERANCE}`);
    }
  }
});
