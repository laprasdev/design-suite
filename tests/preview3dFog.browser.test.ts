// Measures the stage's fog in headless Chromium: two flat patches at distinct depths against the smoothstep formula,
// with and without a height layer read at each patch's world height, every non-Lit Surface mode showing no fog, and
// switching to fog: null matching a never-fogged stage byte-for-byte.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {
  MODEL_STAGE_SURFACE_MODE, type ModelColor, type ModelStageFog, type ModelStageSurfaceMode, type ModelVector,
} from '../src/react/preview3d/model.ts';
import {openScene} from './browserScene.ts';
import {
  FAR_CENTER, FOG_CURVE, FOG_HOSTS_ID, FOG_LAYER_SPEC, FOG_PATCH_URL, FOG_SCENE_ENTRY, FOG_SPEC, FOG_TIME_ID,
  FOG_VIEWPORT, framingCamera, NEAR_CENTER, PATCH_BASE_COLOR, PATCH_EMISSIVE, type FogTimeId, type RgbBytes,
} from './preview3dFogCases.ts';
import {shownBytes, statedBytes} from './preview3dToneCurveOracle.ts';

// One 8-bit framebuffer rounding step across float32 GPU interpolation and tone mapping.
const BYTE_TOLERANCE = 1;

const linearColor = (srgb: ModelColor): THREE.Color => new THREE.Color().setRGB(...srgb, THREE.SRGBColorSpace);

// The fog rule (fog.ts) at a patch's centre, its world height that centre's y.
function expectedFoggedBytes(center: ModelVector, {near, far, height}: ModelStageFog): readonly number[] {
  const camera = framingCamera(FOG_VIEWPORT.width, FOG_VIEWPORT.height);
  const depth = -new THREE.Vector3(...center).applyMatrix4(camera.matrixWorldInverse).z;
  const {smoothstep} = THREE.MathUtils, distance = smoothstep(depth, near.distance, far.distance);
  const layer = height === null ? 0 :
    height.strength * (1 - smoothstep(center[1], height.base, height.top)) * smoothstep(depth, 0, near.distance);
  const fogColor = linearColor(near.color).lerp(linearColor(far.color), distance);
  return shownBytes(linearColor(PATCH_EMISSIVE).lerp(fogColor, distance + layer * (1 - distance)).toArray(), FOG_CURVE);
}

function assertBytesWithin(actual: RgbBytes, expected: readonly number[], tolerance: number, label: string): void {
  const within = actual.every((byte, channel) => Math.abs(byte - expected[channel]) <= tolerance);
  assert.ok(
    within,
    `${label}: canvas [${actual.join(', ')}] differs from expected [${expected.join(', ')}] beyond ±${tolerance}`,
  );
}

const page = await openScene(FOG_SCENE_ENTRY, FOG_VIEWPORT);
await page.locator(`#${FOG_HOSTS_ID}`).waitFor({state: 'attached'});
const glbBytes = Buffer.from(await page.evaluate(() => window.makePatchGlbBytes()));
await page.route(FOG_PATCH_URL, route => route.fulfill({body: glbBytes, contentType: 'model/gltf-binary'}));
await page.evaluate(url => window.bootFogScene(url), FOG_PATCH_URL);

const samplePatch = (time: FogTimeId, mode: ModelStageSurfaceMode) =>
  page.evaluate(arg => window.fogScene.sample(arg.time, arg.mode), {time, mode});

test('each patch in Lit mode shows the fog factor from near, far and its depth within ±1 byte', async () => {
  const measured = await samplePatch(FOG_TIME_ID.haze, MODEL_STAGE_SURFACE_MODE.lit);
  assert.deepEqual([measured.lighting, measured.surfaceMode], [FOG_TIME_ID.haze, MODEL_STAGE_SURFACE_MODE.lit]);
  assertBytesWithin(measured.nearRgb, expectedFoggedBytes(NEAR_CENTER, FOG_SPEC), BYTE_TOLERANCE, 'near patch');
  assertBytesWithin(measured.farRgb, expectedFoggedBytes(FAR_CENTER, FOG_SPEC), BYTE_TOLERANCE, 'far patch');
});

test('each patch in Lit mode shows the height layer at its world height, its placement applied, within ±1 byte',
  async () => {
    const measured = await samplePatch(FOG_TIME_ID.layered, MODEL_STAGE_SURFACE_MODE.lit);
    assert.equal(measured.lighting, FOG_TIME_ID.layered);
    assertBytesWithin(measured.nearRgb, expectedFoggedBytes(NEAR_CENTER, FOG_LAYER_SPEC), BYTE_TOLERANCE,
      'raised near patch');
    assertBytesWithin(measured.farRgb, expectedFoggedBytes(FAR_CENTER, FOG_LAYER_SPEC), BYTE_TOLERANCE, 'far patch');
  });

test('every Surface mode other than Lit shows no fog on either patch', async () => {
  const colorSample = await samplePatch(FOG_TIME_ID.haze, MODEL_STAGE_SURFACE_MODE.color);
  assertBytesWithin(colorSample.nearRgb, statedBytes(PATCH_BASE_COLOR), BYTE_TOLERANCE, 'Color near');
  assert.deepEqual(colorSample.farRgb, colorSample.nearRgb, 'Color far equals near');

  const emissionSample = await samplePatch(FOG_TIME_ID.haze, MODEL_STAGE_SURFACE_MODE.emission);
  const unfoggedEmission = shownBytes(linearColor(PATCH_EMISSIVE).toArray(), FOG_CURVE);
  assertBytesWithin(emissionSample.nearRgb, unfoggedEmission, BYTE_TOLERANCE, 'Emission near');
  assert.deepEqual(emissionSample.farRgb, emissionSample.nearRgb, 'Emission far equals near');

  const claySample = await samplePatch(FOG_TIME_ID.haze, MODEL_STAGE_SURFACE_MODE.clay);
  assertBytesWithin(claySample.nearRgb, [0, 0, 0], 0, 'Clay near');
  assert.deepEqual(claySample.farRgb, claySample.nearRgb, 'Clay far equals near');
});

test('with fog: null the whole frame equals a stage whose look never had fog, byte-for-byte', async () => {
  await samplePatch(FOG_TIME_ID.haze, MODEL_STAGE_SURFACE_MODE.lit);
  const parity = await page.evaluate(() => window.fogScene.compareNullFogWithNeverFogged());
  assert.equal(parity.byteLength, FOG_VIEWPORT.width * FOG_VIEWPORT.height * 4);
  assert.equal(parity.differingBytes, 0, parity.firstDiff ?? 'frames match');
});
