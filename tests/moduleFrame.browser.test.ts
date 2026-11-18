// A module's corners are the page's cutout radius at every width, whatever its skin draws the border with. Read in
// Chromium from moduleFrameScene.tsx at a desktop and a phone width.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {D} from '../src/synth/design/index.ts';
import {DESKTOP_VIEWPORT, PHONE_VIEWPORT, openScene} from './browserScene.ts';
import {MODULE_FRAME_CASES, ModuleFrameElement} from './moduleFrameCases.ts';

const page = await openScene('tests/moduleFrameScene.tsx', DESKTOP_VIEWPORT);
const frames = page.locator(ModuleFrameElement.selector);
await frames.first().waitFor();

for (const viewport of [DESKTOP_VIEWPORT, PHONE_VIEWPORT]) test(`at ${viewport.width}px`, async t => {
  await page.setViewportSize(viewport);
  await t.test('every module frame rounds its corners by the cutout radius', async () => {
    const corners = await frames.evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      return {name: node.getAttribute('title'), corners: [style.borderTopLeftRadius, style.borderTopRightRadius,
        style.borderBottomRightRadius, style.borderBottomLeftRadius]};
    }));
    assert.equal(corners.length, MODULE_FRAME_CASES.length);
    const cutout = Array(4).fill(`${D.radius.cutout}px`);
    for (const {name, corners: radii} of corners) assert.deepEqual(radii, cutout, name ?? '');
  });
});
