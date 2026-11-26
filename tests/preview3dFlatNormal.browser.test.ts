// An empty normal slot holds the flat-normal constant: a lit kind that reads it through Unity's `UnpackNormalRGB` or
// its default `UnpackNormalMapRGorAG` lights as it does reading no normal map at all. Measured in headless Chromium
// through the stage's kind materials and textures.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openScene, SCENE_GL} from './browserScene.ts';
import {FRAME_PIXEL} from './framePixels.ts';
import {FLAT_NORMAL_SCENE_ENTRY, FLAT_NORMAL_VIEWPORT, NORMAL_DECODE, type NormalDecode, UNPACKED_DECODES}
  from './preview3dFlatNormalCases.ts';

// The constant's halves are 128 of 255, x and y 0.0039 off zero once unpacked under either decoder: the light that
// turns is within one byte.
const BYTE_TOLERANCE = 1;
const {stride: STRIDE, colorChannels: CHANNELS} = FRAME_PIXEL;

const page = await openScene(FLAT_NORMAL_SCENE_ENTRY, FLAT_NORMAL_VIEWPORT, SCENE_GL.software);
const draw = async (decode: NormalDecode) => (await page.evaluate(arg => window.drawFlatNormal(arg), decode))
  .pixels.filter((_, index) => index % STRIDE < CHANNELS);

test('a flat normal, read by each Unity decoder, lights as no normal map does, within one byte', async () => {
  const plain = await draw(NORMAL_DECODE.none);
  assert.ok(plain.every(byte => byte > 0 && byte < 255), 'the square fills the frame, lit, unsaturated');
  for (const decode of UNPACKED_DECODES) {
    const mapped = await draw(decode);
    const worst = Math.max(...mapped.map((byte, index) => Math.abs(byte - plain[index])));
    assert.ok(worst <= BYTE_TOLERANCE, `decode ${decode} differs by ${worst} bytes, beyond ±${BYTE_TOLERANCE}`);
  }
});
