import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';
import {MODEL_STAGE, MODEL_STAGE_SURFACE_MODE} from '../src/react/preview3d/model.ts';
import {isRecord} from '../src/valueChecks.ts';
import {openScene, SCENE_GL} from './browserScene.ts';
import type {TerrainViewport} from './preview3dTerrainCases.ts';
import {SUITE_ROOT} from './bundled.ts';
import {ALT_CANVAS_SRGB, BOTTOM_CANVAS_SRGB, CAMERA_HOST_ID, CAMERA_ROUTES, CAMERA_SCENE_ENTRY, CAMERA_VIEWPORTS,
  FRAME_CAMERA_POSE, PAINTED_PROGRAM, TOP_CANVAS_SRGB} from './preview3dFrameCameraCases.ts';
import {statedBytes} from './preview3dToneCurveOracle.ts';

const CAPTURES = join(SUITE_ROOT, '.local', 'captures', 'preview3dFrameCamera');
mkdirSync(CAPTURES, {recursive: true});
const programSha256 = createHash('sha256').update(PAINTED_PROGRAM).digest('hex');
const BYTE_TOLERANCE = 2;
const PROFILE_TICKS = 2000;
const PROFILE_PAIRS = 2;
const SAMPLING_INTERVAL_BYTES = 64;

async function bootPage(viewport: TerrainViewport) {
  const page = await openScene(CAMERA_SCENE_ENTRY, viewport, SCENE_GL.software);
  await page.locator(`#${CAMERA_HOST_ID}`).waitFor({state: 'attached'});
  const panelBytes = Buffer.from(await page.evaluate(() => window.makePanelGlbBytes()));
  await page.route(CAMERA_ROUTES.panel, route => route.fulfill({body: panelBytes, contentType: 'model/gltf-binary'}));
  await page.route(CAMERA_ROUTES.program, route => route.fulfill({body: PAINTED_PROGRAM, contentType: 'text/plain'}));
  await page.evaluate(sha => window.bootFrameCameraScene(sha), programSha256);
  return page;
}

function assertBytesClose(actual: readonly [number, number, number], expected: readonly number[], label: string) {
  const ok = actual.every((byte, idx) => Math.abs(byte - expected[idx]) <= BYTE_TOLERANCE);
  assert.ok(ok, `${label}: actual [${actual.join(', ')}] vs expected [${expected.join(', ')}]`);
}

function nodeFunctionName(node: unknown): string {
  if (!isRecord(node) || !isRecord(node.callFrame)) return '';
  return typeof node.callFrame.functionName === 'string' ? node.callFrame.functionName : '';
}

function sumProfileBytes(node: unknown): number {
  if (!isRecord(node)) return 0;
  let total = typeof node.selfSize === 'number' ? node.selfSize : 0;
  if (Array.isArray(node.children)) {
    for (const child of node.children) total += sumProfileBytes(child);
  }
  return total;
}

function sumNamedBytes(node: unknown, target: string, underParent = true, parentName?: string): number {
  if (!isRecord(node)) return 0;
  const name = nodeFunctionName(node);
  const inside = underParent || name === parentName;
  let total = inside && name === target && typeof node.selfSize === 'number' ? node.selfSize : 0;
  if (Array.isArray(node.children)) {
    for (const child of node.children) total += sumNamedBytes(child, target, inside, parentName);
  }
  return total;
}

for (const [name, viewport] of Object.entries(CAMERA_VIEWPORTS)) {
  test(`at the ${name} view, captures separate before/after pairs for frame camera and image surface`, async () => {
    const page = await bootPage(viewport);
    const cameraBefore = await page.evaluate(() => window.frameCameraScene.showFileDefaultCamera());
    await page.screenshot({path: join(CAPTURES, `${name}-camera-before.png`)});
    assert.equal(cameraBefore.held, false);
    assert.equal(cameraBefore.fieldOfView, MODEL_STAGE.fieldOfView);

    const cameraAfter = await page.evaluate(() => window.frameCameraScene.showFileFrameCamera());
    await page.screenshot({path: join(CAPTURES, `${name}-camera-after.png`)});
    assert.deepEqual(cameraAfter, {...FRAME_CAMERA_POSE, held: true});

    const restored = await page.evaluate(() => window.frameCameraScene.resetView());
    assert.equal(restored.held, false);
    assert.equal(restored.fieldOfView, MODEL_STAGE.fieldOfView);

    const imageBefore = await page.evaluate(() => window.frameCameraScene.showFileDefaultCamera());
    await page.screenshot({path: join(CAPTURES, `${name}-image-before.png`)});
    assert.equal(imageBefore.held, false);

    const imageAfter = await page.evaluate(() => window.frameCameraScene.showImageDefaultCamera());
    await page.screenshot({path: join(CAPTURES, `${name}-image-after.png`)});
    assert.deepEqual(imageAfter, imageBefore, 'image surface capture keeps identical focus camera framing');
  });
}

test('verifies sRGB colour space, flipY false orientation, fog, Surface modes, image replacement and GC camera delta',
  async () => {
    const page = await bootPage(CAMERA_VIEWPORTS.desktop);
    // In Three's BoxGeometry front face (+Z), glTF UV v=0 is at the bottom and v=1 is at the top; with flipY=false,
    // canvas row 0 (TOP_CANVAS_SRGB) samples at v=0 (lower half on screen) and canvas bottom row at v=1 (upper half).
    const colorSample = await page.evaluate(
      mode => window.frameCameraScene.sampleBands(mode, false), MODEL_STAGE_SURFACE_MODE.color);
    assertBytesClose(colorSample.lowerRgb, statedBytes(TOP_CANVAS_SRGB), 'Color lower half (v=0, flipY=false)');
    assertBytesClose(colorSample.upperRgb, statedBytes(BOTTOM_CANVAS_SRGB), 'Color upper half (v=1, flipY=false)');

    const claySample = await page.evaluate(
      mode => window.frameCameraScene.sampleBands(mode, false), MODEL_STAGE_SURFACE_MODE.clay);
    assert.deepEqual(claySample.lowerRgb, claySample.upperRgb, 'Clay strips painted bands to uniform clay');
    assert.ok(claySample.lowerRgb[0] > 0 && claySample.lowerRgb[0] === claySample.lowerRgb[1] &&
      claySample.lowerRgb[1] === claySample.lowerRgb[2], 'Clay renders neutral grey');

    const emissionSample = await page.evaluate(
      mode => window.frameCameraScene.sampleBands(mode, false), MODEL_STAGE_SURFACE_MODE.emission);
    assertBytesClose(emissionSample.lowerRgb, [0, 0, 0], 'Emission lower');
    assertBytesClose(emissionSample.upperRgb, [0, 0, 0], 'Emission upper');

    const unfoggedLit = await page.evaluate(
      mode => window.frameCameraScene.sampleBands(mode, false), MODEL_STAGE_SURFACE_MODE.lit);
    const foggedLit = await page.evaluate(
      mode => window.frameCameraScene.sampleBands(mode, true), MODEL_STAGE_SURFACE_MODE.lit);
    assert.notDeepEqual(foggedLit.upperRgb, unfoggedLit.upperRgb, 'Lit mode applies stage fog to image surface');

    const swappedRgb = await page.evaluate(() => window.frameCameraScene.showSwappedImage());
    assertBytesClose(swappedRgb, statedBytes(ALT_CANVAS_SRGB), 'Swapped canvas image updates drawn surface');

    // Return to Lit mode, warm up V8 JIT across animation frames, then measure GC-inclusive differential bytes/tick.
    await page.evaluate(async () => {
      await window.frameCameraScene.showFileFrameCamera();
      for (let pass = 0; pass < 6; pass++) {
        window.frameCameraScene.runTicks(2500, false);
        window.frameCameraScene.runTicks(2500, true);
        await new Promise<number>(resolve => requestAnimationFrame(resolve));
      }
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');

    const sampleRun = async (withCamera: boolean) => {
      await cdp.send('HeapProfiler.startSampling', {
        samplingInterval: SAMPLING_INTERVAL_BYTES,
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
      await page.evaluate(
        ({ticks, camera}) => window.frameCameraScene.runTicks(ticks, camera),
        {ticks: PROFILE_TICKS, camera: withCamera},
      );
      const {profile} = await cdp.send('HeapProfiler.stopSampling');
      return {bytesPerTick: Math.round(sumProfileBytes(profile.head) / PROFILE_TICKS), head: profile.head};
    };

    // Warm up one sampled pair after HeapProfiler.enable so sampling trampolines settle before recording.
    await sampleRun(false);
    await sampleRun(true);
    const withoutRuns: number[] = [];
    const withRuns: number[] = [];
    for (let pair = 0; pair < PROFILE_PAIRS; pair++) {
      withoutRuns.push((await sampleRun(false)).bytesPerTick);
      const withSample = await sampleRun(true);
      withRuns.push(withSample.bytesPerTick);
      assert.equal(sumNamedBytes(withSample.head, 'freezeModelPreviewCamera'), 0, 'tick allocates no frozen camera');
      assert.equal(sumNamedBytes(withSample.head, 'hypot', false, 'readModelFrameCamera'), 0, 'no hypot on camera');
      assert.equal(sumNamedBytes(withSample.head, 'hypot', false, 'readModelPreviewCamera'), 0, 'no hypot on camera');
    }
    const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const withoutMean = Math.round(mean(withoutRuns));
    const withMean = Math.round(mean(withRuns));
    const extraBytesPerTick = withMean - withoutMean;
    const report = {
      ticksPerRun: PROFILE_TICKS,
      pairs: PROFILE_PAIRS,
      samplingIntervalBytes: SAMPLING_INTERVAL_BYTES,
      includeObjectsCollectedByMinorGC: true,
      includeObjectsCollectedByMajorGC: true,
      withoutCameraBytesPerTick: withoutRuns,
      withCameraBytesPerTick: withRuns,
      withoutMeanBytesPerTick: withoutMean,
      withMeanBytesPerTick: withMean,
      extraBytesPerTick,
    };
    writeFileSync(join(CAPTURES, 'allocation-profile.json'), `${JSON.stringify(report, null, 2)}\n`);
  });
