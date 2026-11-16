// Measures the stage's fog in headless Chromium: two flat patches at distinct depths against the smoothstep formula,
// every non-Lit Surface mode showing no fog, and switching to fog: null matching a never-fogged stage byte-for-byte.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {openScene} from './browserScene.ts';
import {
  FAR_PATCH_DEPTH, FOG_CURVE, FOG_HOSTS_ID, FOG_PATCH_URL, FOG_SCENE_ENTRY, FOG_SPEC, FOG_VIEWPORT,
  NEAR_PATCH_DEPTH, PATCH_BASE_COLOR, PATCH_EMISSIVE, type FogTimeId, type RgbBytes,
} from './preview3dFogCases.ts';
import {shownBytes, statedBytes} from './preview3dToneCurveOracle.ts';

// One 8-bit framebuffer rounding step across float32 GPU interpolation and tone mapping.
const BYTE_TOLERANCE = 1;

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const clamped = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return clamped * clamped * (3 - 2 * clamped);
};

const srgbToLinear = (srgb: readonly number[]): readonly [number, number, number] => {
  const color = new THREE.Color().setRGB(srgb[0], srgb[1], srgb[2], THREE.SRGBColorSpace);
  return [color.r, color.g, color.b];
};

const mixRgb = (from: readonly number[], to: readonly number[], factor: number): readonly [number, number, number] => [
  from[0] + (to[0] - from[0]) * factor,
  from[1] + (to[1] - from[1]) * factor,
  from[2] + (to[2] - from[2]) * factor,
];

function expectedFoggedBytes(depth: number): readonly number[] {
  const factor = smoothstep(FOG_SPEC.near.distance, FOG_SPEC.far.distance, depth);
  const surface = srgbToLinear(PATCH_EMISSIVE);
  const fogColor = mixRgb(srgbToLinear(FOG_SPEC.near.color), srgbToLinear(FOG_SPEC.far.color), factor);
  return shownBytes(mixRgb(surface, fogColor, factor), FOG_CURVE);
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

const samplePatch = (time: FogTimeId, surfaceMode: 'lit' | 'clay' | 'color' | 'emission') =>
  page.evaluate(([chosenTime, mode]) => window.fogScene.sample(chosenTime, mode), [time, surfaceMode] as const);

test('each patch in Lit mode shows the fog factor from near, far and its depth within ±1 byte', async () => {
  const measured = await samplePatch('haze', 'lit');
  assert.deepEqual([measured.lighting, measured.surfaceMode], ['haze', 'lit']);
  assertBytesWithin(measured.nearRgb, expectedFoggedBytes(NEAR_PATCH_DEPTH), BYTE_TOLERANCE, 'near patch');
  assertBytesWithin(measured.farRgb, expectedFoggedBytes(FAR_PATCH_DEPTH), BYTE_TOLERANCE, 'far patch');
});

test('every Surface mode other than Lit shows no fog on either patch', async () => {
  const colorSample = await samplePatch('haze', 'color');
  assertBytesWithin(colorSample.nearRgb, statedBytes(PATCH_BASE_COLOR), BYTE_TOLERANCE, 'Color near');
  assert.deepEqual(colorSample.farRgb, colorSample.nearRgb, 'Color far equals near');

  const emissionSample = await samplePatch('haze', 'emission');
  const unFoggedEmission = shownBytes(srgbToLinear(PATCH_EMISSIVE), FOG_CURVE);
  assertBytesWithin(emissionSample.nearRgb, unFoggedEmission, BYTE_TOLERANCE, 'Emission near');
  assert.deepEqual(emissionSample.farRgb, emissionSample.nearRgb, 'Emission far equals near');

  const claySample = await samplePatch('haze', 'clay');
  assertBytesWithin(claySample.nearRgb, [0, 0, 0], 0, 'Clay near');
  assert.deepEqual(claySample.farRgb, claySample.nearRgb, 'Clay far equals near');
});

test('with fog: null the whole frame equals a stage whose look never had fog, byte-for-byte', async () => {
  await samplePatch('haze', 'lit');
  const parity = await page.evaluate(() => window.fogScene.compareNullFogWithNeverFogged());
  assert.equal(parity.byteLength, FOG_VIEWPORT.width * FOG_VIEWPORT.height * 4);
  assert.equal(parity.differingBytes, 0, parity.firstDiff ?? 'frames match');
});
