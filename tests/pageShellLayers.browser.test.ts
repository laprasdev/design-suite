// The page shell's z-layers paint in exact bottom-to-top order in Chromium, with the arrange chip above a held tile
// and the held tile above arrange gutters, frames and flip layers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DESKTOP_VIEWPORT, openScene, SCENE_GL} from './browserScene.ts';
import {STAGE_STACK_BOTTOM_TO_TOP, StageLayersHost} from './pageShellLayersCases.ts';

const page = await openScene('tests/pageShellLayersScene.tsx', DESKTOP_VIEWPORT, SCENE_GL.software);
const host = page.locator(StageLayersHost.selector);
await host.locator('[data-arrange-chip]').waitFor();

test('the arrange chip paints above a held tile, and every stage layer paints in stack order', async () => {
  const paintedTopToBottom = await host.evaluate((node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    return document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      .flatMap(element => {
        const layer = element.getAttribute('data-stage-layer');
        return layer ? [layer] : [];
      });
  });
  assert.deepEqual(paintedTopToBottom, [...STAGE_STACK_BOTTOM_TO_TOP].reverse());
});
