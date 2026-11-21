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

const CAMERA_FUNCTIONS = new Set(['readModelFrameCamera', 'readModelPreviewCamera', 'readVector3',
  'modelRecordStating', 'applyPose', 'pose']);

function sumProfileNode(node: unknown): {totalBytes: number; cameraBytes: number} {
  if (!isRecord(node)) return {totalBytes: 0, cameraBytes: 0};
  const selfSize = typeof node.selfSize === 'number' ? node.selfSize : 0;
  const fnName = isRecord(node.callFrame) && typeof node.callFrame.functionName === 'string'
    ? node.callFrame.functionName
    : '';
  let totalBytes = selfSize;
  let cameraBytes = CAMERA_FUNCTIONS.has(fnName) ? selfSize : 0;
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const sub = sumProfileNode(child);
      totalBytes += sub.totalBytes;
      cameraBytes += sub.cameraBytes;
    }
  }
  return {totalBytes, cameraBytes};
}

for (const [name, viewport] of Object.entries(CAMERA_VIEWPORTS)) {
  test(`at the ${name} view, captures before/after frame camera and in-memory image surface, and restores on reset`,
    async () => {
      const page = await bootPage(viewport);
      const before = await page.evaluate(() => window.frameCameraScene.showBefore());
      await page.screenshot({path: join(CAPTURES, `${name}-before.png`)});
      assert.equal(before.held, false);
      assert.equal(before.fieldOfView, MODEL_STAGE.fieldOfView);

      const after = await page.evaluate(() => window.frameCameraScene.showAfter());
      await page.screenshot({path: join(CAPTURES, `${name}-after.png`)});
      assert.deepEqual(after, {...FRAME_CAMERA_POSE, held: true});

      const restored = await page.evaluate(() => window.frameCameraScene.resetView());
      assert.equal(restored.held, false);
      assert.equal(restored.fieldOfView, MODEL_STAGE.fieldOfView);
    });
}

test('verifies sRGB colour space, flipY false orientation, fog, Surface modes, image replacement and 0 camera allocs',
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

    // Return to Lit mode, warm up V8 JIT across animation frames so concurrent compilation installs, then sample CDP.
    await page.evaluate(async () => {
      await window.frameCameraScene.showAfter();
      for (let pass = 0; pass < 4; pass++) {
        window.frameCameraScene.runTicks(1500, false);
        window.frameCameraScene.runTicks(1500, true);
        await new Promise<number>(resolve => requestAnimationFrame(resolve));
      }
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('HeapProfiler.enable');

    await cdp.send('HeapProfiler.startSampling', {samplingInterval: 64});
    await page.evaluate(() => window.frameCameraScene.runTicks(2000, false));
    const withoutProfile = await cdp.send('HeapProfiler.stopSampling');
    const withoutStats = sumProfileNode(withoutProfile.profile.head);

    await cdp.send('HeapProfiler.startSampling', {samplingInterval: 64});
    await page.evaluate(() => window.frameCameraScene.runTicks(2000, true));
    const withProfile = await cdp.send('HeapProfiler.stopSampling');
    const withStats = sumProfileNode(withProfile.profile.head);

    const report = {
      ticks: 2000,
      samplingIntervalBytes: 64,
      withoutCamera: {...withoutStats, bytesPerTick: Math.round(withoutStats.totalBytes / 2000)},
      withCamera: {...withStats, bytesPerTick: Math.round(withStats.totalBytes / 2000)},
    };
    writeFileSync(join(CAPTURES, 'allocation-profile.json'), `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(withStats.cameraBytes, 0,
      `Frame camera path must allocate 0 bytes; measured ${withStats.cameraBytes} bytes.`);
  });
