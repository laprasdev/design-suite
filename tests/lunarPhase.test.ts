import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MoonPhaseName, litPath, lunarPhase } from '../src/react/sky/lunarPhase.ts';

// Published times of January 2024's phases, UTC.
const NEW = new Date(Date.UTC(2024, 0, 11, 11, 57));
const FIRST_QUARTER = new Date(Date.UTC(2024, 0, 18, 3, 53));
const FULL = new Date(Date.UTC(2024, 0, 25, 17, 54));
const LAST_QUARTER = new Date(Date.UTC(2024, 1, 2, 23, 18));
// Within a percent of the lit face.
const CLOSE = 0.01;

test('the phase follows the real moon through a month', () => {
  assert.ok(lunarPhase(NEW).illuminated < CLOSE);
  assert.ok(lunarPhase(FULL).illuminated > 1 - CLOSE);
  assert.ok(Math.abs(lunarPhase(FIRST_QUARTER).illuminated - 0.5) < CLOSE);
  assert.ok(Math.abs(lunarPhase(LAST_QUARTER).illuminated - 0.5) < CLOSE);
  assert.equal(lunarPhase(FIRST_QUARTER).waxing, true);
  assert.equal(lunarPhase(LAST_QUARTER).waxing, false);
});

test('each phase has its name', () => {
  assert.equal(lunarPhase(NEW).name, MoonPhaseName.NEW);
  assert.equal(lunarPhase(FIRST_QUARTER).name, MoonPhaseName.FIRST_QUARTER);
  assert.equal(lunarPhase(FULL).name, MoonPhaseName.FULL);
  assert.equal(lunarPhase(LAST_QUARTER).name, MoonPhaseName.LAST_QUARTER);
  assert.equal(lunarPhase(new Date(Date.UTC(2024, 0, 21))).name, MoonPhaseName.WAXING_GIBBOUS);
  assert.equal(lunarPhase(new Date(Date.UTC(2024, 1, 6))).name, MoonPhaseName.WANING_CRESCENT);
});

test('a waxing moon is lit on the right and a waning one on the left, with the terminator bulging by phase', () => {
  const disc = { cx: 10, cy: 10, r: 8 };
  // Limb from the top round the right (sweep 1) or the left (sweep 0); a crescent's terminator bulges toward the limb.
  assert.match(litPath({ cycle: 0.1, waxing: true }, disc), /A8 8 0 0 1/);
  assert.match(litPath({ cycle: 0.1, waxing: true }, disc), /A[\d.]+ 8 0 0 0 10 2Z$/);
  assert.match(litPath({ cycle: 0.4, waxing: true }, disc), /A[\d.]+ 8 0 0 1 10 2Z$/);
  assert.match(litPath({ cycle: 0.9, waxing: false }, disc), /A8 8 0 0 0/);
  assert.match(litPath({ cycle: 0.9, waxing: false }, disc), /A[\d.]+ 8 0 0 1 10 2Z$/);
  assert.match(litPath({ cycle: 0.6, waxing: false }, disc), /A[\d.]+ 8 0 0 0 10 2Z$/);
});
