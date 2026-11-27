// A kind that reads `kindWorldPosition` sees the same world point for the same placed geometry whatever object
// transform places it: as given, moved by its mesh's transform, moved as one instance, or moved as one batched
// geometry. Measured in headless Chromium through the stage's own kind program.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openScene, SCENE_GL} from './browserScene.ts';
import {FRAME_PIXEL} from './framePixels.ts';
import {expectedBytes, WORLD_PLACEMENT, WORLD_SCENE_ENTRY, WORLD_VIEWPORT, type WorldPlacement}
  from './preview3dWorldPositionCases.ts';

// One 8-bit rounding step across float32 interpolation.
const BYTE_TOLERANCE = 1;
const {stride: STRIDE, colorChannels: CHANNELS} = FRAME_PIXEL;
const {width} = WORLD_VIEWPORT, centre = width / 2;

const page = await openScene(WORLD_SCENE_ENTRY, WORLD_VIEWPORT, SCENE_GL.software);
const draw = (placement: WorldPlacement) => page.evaluate(arg => window.drawWorldPlacement(arg), placement);
const rgbAt = (pixels: readonly number[], x: number, y: number) =>
  pixels.slice((y * width + x) * STRIDE, (y * width + x) * STRIDE + CHANNELS);
function assertWithin(actual: readonly number[], expected: readonly number[], label: string) {
  assert.ok(actual.every((byte, channel) => Math.abs(byte - expected[channel]) <= BYTE_TOLERANCE),
    `${label}: [${actual.join(', ')}] differs from [${expected.join(', ')}] beyond ±${BYTE_TOLERANCE}`);
}

test('the square shows its world point at each pixel, under each placement, within ±1 byte', async () => {
  const still = (await draw(WORLD_PLACEMENT.still)).pixels;
  // Inside the square (world x and y from 1 to 3 of 4 metres), away from its edges.
  const inside = [width * 0.3, centre, width * 0.7].map(Math.floor);
  for (const placement of Object.values(WORLD_PLACEMENT)) {
    const {pixels} = await draw(placement);
    for (const x of inside) {
      for (const y of inside) {
        assertWithin(rgbAt(pixels, x, y), expectedBytes(x, y), `${placement} at ${x}, ${y}`);
        assertWithin(rgbAt(pixels, x, y), rgbAt(still, x, y), `${placement} against still at ${x}, ${y}`);
      }
    }
  }
});
