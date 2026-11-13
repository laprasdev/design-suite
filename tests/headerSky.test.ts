import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONSTELLATIONS, DOTS } from '../src/react/sky/stars.ts';
import { TOP_ALTITUDE, horizontal, inStrip } from '../src/react/sky/skyPosition.ts';
import { namePosition } from '../src/react/sky/skyName.ts';

const CHICAGO = { latitude: 41.85, longitude: -87.65 };
const NOW = new Date(Date.UTC(2026, 10, 3, 4));

test('Polaris stands due north at the latitude, whatever the hour', () => {
  for (const hours of [0, 6, 13]) {
    const { altitude, azimuth } = horizontal({ ra: 2.53, dec: 89.26 }, CHICAGO,
      new Date(NOW.getTime() + hours * 3.6e6));
    assert.ok(Math.abs(altitude - CHICAGO.latitude) < 1, `altitude ${altitude}`);
    assert.ok(azimuth < 1.5 || azimuth > 358.5, `azimuth ${azimuth}`);
  }
});

test('a star crossing the meridian is due south, as high as the equator lets it', () => {
  // Local sidereal time at NOW, in hours, puts a star of that right ascension on the meridian.
  const days = NOW.getTime() / 86_400_000 + 2440587.5 - 2451545;
  const ra = (((280.46061837 + 360.98564736629 * days + CHICAGO.longitude) % 360 + 360) % 360) / 15;
  const { altitude, azimuth } = horizontal({ ra, dec: 0 }, CHICAGO, NOW);
  assert.ok(Math.abs(azimuth - 180) < 0.01);
  assert.ok(Math.abs(altitude - (90 - CHICAGO.latitude)) < 0.01);
});

test('the strip faces south with east on the left, from the grass to its top altitude', () => {
  assert.deepEqual(inStrip({ altitude: 0, azimuth: 90 }), { x: 0.25, y: 0 });
  assert.deepEqual(inStrip({ altitude: TOP_ALTITUDE, azimuth: 270 }), { x: 0.75, y: 1 });
  assert.equal(inStrip({ altitude: -1, azimuth: 180 }), null);
  assert.equal(inStrip({ altitude: TOP_ALTITUDE + 1, azimuth: 180 }), null);
});

test('every figure draws only its own stars, and names are unique', () => {
  assert.equal(new Set(CONSTELLATIONS.map(c => c.name)).size, CONSTELLATIONS.length);
  for (const c of CONSTELLATIONS) {
    for (const run of c.lines) for (const key of run) assert.ok(c.stars[key], `${c.name} has no ${key}`);
  }
  assert.ok(DOTS.every(d => d.ra >= 0 && d.ra < 24 && Math.abs(d.dec) <= 90));
});

test('names choose clear space beside a figure and stay within the header', () => {
  const scene = { figure: { left: 180, right: 200, top: 0, bottom: 22 }, obstacles: [],
    width: 400, height: 32, label: { width: 96, height: 16 }, gap: 6, inset: 2 };
  const actor = { left: 205, right: 330, top: 0, bottom: 32 };
  assert.equal(namePosition({ ...scene, obstacles: [actor] }).direction, -1);
  assert.equal(namePosition({ ...scene, obstacles: [{ ...actor, left: 45, right: 175 }] }).direction, 1);
  for (const figure of [{ left: 0, right: 20, top: -5, bottom: 4 },
    { left: 380, right: 400, top: 30, bottom: 35 }]) {
    const label = namePosition({ ...scene, figure });
    assert.ok(label.left >= 2 && label.left + scene.label.width <= scene.width - 2);
    assert.ok(label.top >= 2 && label.top + scene.label.height <= scene.height - 2);
    assert.ok(label.left >= figure.right || label.left + scene.label.width <= figure.left);
  }
});

test('crowded names move past an obstruction rather than covering it', () => {
  const placed = namePosition({ figure: { left: 50, right: 65, top: 8, bottom: 20 },
    obstacles: [{ left: 70, right: 100, top: 0, bottom: 32 }], width: 260, height: 32,
    label: { width: 100, height: 16 }, gap: 6, inset: 2 });
  assert.equal(placed.direction, 1);
  assert.equal(placed.collision, 0);
  assert.ok(placed.left >= 106);
});
