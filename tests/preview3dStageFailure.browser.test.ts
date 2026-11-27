// The stage's one failure route, measured in headless Chromium through createModelStage: a host grown past the frame's
// budget is refused by name to `onError`, once, and the stage asks for no frame and follows no size after it.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {openScene, SCENE_GL} from './browserScene.ts';
import {budgetRefusal, OVER} from './preview3dFrameBudgetCases.ts';
import {STAGE_FAILURE_PATCH_URL, STAGE_FAILURE_SCENE_ENTRY, STAGE_FAILURE_VIEWPORT}
  from './preview3dStageFailureCases.ts';

// The refusal as `onError` hears it across the page: the error's name, then its message.
const REFUSAL = `${new ModelStageRefusal('').name}: ${budgetRefusal(OVER)}`;
const {width, height} = STAGE_FAILURE_VIEWPORT;

const page = await openScene(STAGE_FAILURE_SCENE_ENTRY, STAGE_FAILURE_VIEWPORT, SCENE_GL.software);
const patch = Buffer.from(await page.evaluate(() => window.makeStageFailurePatch()));
await page.route(STAGE_FAILURE_PATCH_URL, route => route.fulfill({body: patch, contentType: 'model/gltf-binary'}));
await page.evaluate(url => window.bootStageFailure(url), STAGE_FAILURE_PATCH_URL);
const resize = (to: {readonly x: number; readonly y: number}) =>
  page.evaluate(([x, y]) => window.resizeStageHost(x, y), [to.x, to.y]);

test('a host grown past the frame\'s budget fails the stage once: no frame and no size follows', async () => {
  const drawing = await resize({x: width, y: height});
  assert.deepEqual([drawing.failures, drawing.canvas], [[], [width, height]]);
  assert.ok(drawing.framesAsked > 0, 'the stage draws while its size is held');
  const refused = await resize(OVER);
  assert.deepEqual([refused.failures, refused.canvas], [[REFUSAL], [width, height]]);
  // At most the one frame asked for in the page frame before the size reached the stage's observer.
  assert.ok(refused.framesAsked <= 1, `the stage asked for ${refused.framesAsked} frames after its refusal`);
  for (const after of [await resize(OVER), await resize({x: height, y: width})]) {
    assert.deepEqual([after.failures, after.canvas, after.framesAsked], [[REFUSAL], [width, height], 0]);
  }
});
