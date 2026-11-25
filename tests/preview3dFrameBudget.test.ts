// The frame's GPU memory is a budget (linearFrame.ts): a drawing buffer whose frame would pass it is refused by name,
// at creation and at every resize, naming its size, its bytes and how far over.
import assert from 'node:assert/strict';
import {it} from 'node:test';
import * as THREE from 'three';
import {checkModelLinearFrameBudget, createModelLinearFrame, MODEL_LINEAR_FRAME_BUDGET, MODEL_LINEAR_FRAME_TEXT}
  from '../src/react/preview3d/linearFrame.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';

// The bytes measured per drawing-buffer pixel on the stage (2026-11-25), not read from the frame.
const MEASURED_PIXEL_BYTES = 60;
// A 4K drawing buffer, which the placeholder holds, and a 5K one, which it refuses.
const HELD = new THREE.Vector2(3840, 2160), OVER = new THREE.Vector2(5120, 2880);
const refused = ({x, y}: THREE.Vector2) => (error: unknown) => error instanceof ModelStageRefusal && error.message ===
  MODEL_LINEAR_FRAME_TEXT.budget(x, y, x * y * MEASURED_PIXEL_BYTES, MODEL_LINEAR_FRAME_BUDGET.bytes);

it('holds a drawing buffer within the budget and refuses one past it, by name', () => {
  checkModelLinearFrameBudget(HELD.x, HELD.y);
  assert.throws(() => checkModelLinearFrameBudget(OVER.x, OVER.y), refused(OVER));
  createModelLinearFrame(HELD).dispose();
  assert.throws(() => createModelLinearFrame(OVER), refused(OVER));
});
