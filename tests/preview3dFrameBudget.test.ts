// The frame's GPU memory is a budget (`MODEL_STAGE.frameBytesLimit`): a drawing buffer whose frame would pass it is
// refused by name, at creation and at every resize, naming its size, its bytes and how far over; a refused resize
// leaves the frame at the size it had.
import assert from 'node:assert/strict';
import {it} from 'node:test';
import * as THREE from 'three';
import {createModelLinearFrame, MODEL_LINEAR_FRAME_TEXT} from '../src/react/preview3d/linearFrame.ts';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';

// The bytes per drawing-buffer pixel from the formats' sizes (perf-budgets' measured.md, Stage, "The stage's linear
// frame"), written here, not read from the frame.
const PIXEL_BYTES = 60;
// A 1080p screen at the stage's pixel-ratio limit, which the placeholder holds, and a 5K drawing buffer, which it
// refuses.
const HELD = new THREE.Vector2(1920, 1080).multiplyScalar(MODEL_STAGE.pixelRatioLimit);
const OVER = new THREE.Vector2(5120, 2880);
const refused = ({x, y}: THREE.Vector2) => (error: unknown) => error instanceof ModelStageRefusal && error.message ===
  MODEL_LINEAR_FRAME_TEXT.budget(x, y, x * y * PIXEL_BYTES, MODEL_STAGE.frameBytesLimit);

it('makes a frame within the budget and refuses one past it, by name', () => {
  createModelLinearFrame(HELD).dispose();
  assert.throws(() => createModelLinearFrame(OVER), refused(OVER));
});

it('refuses a resize past the budget by name and keeps the size it had', () => {
  const frame = createModelLinearFrame(HELD);
  try {
    assert.throws(() => frame.resize(OVER.x, OVER.y), refused(OVER));
    assert.deepEqual([frame.target.width, frame.target.height], [HELD.x, HELD.y]);
    frame.resize(HELD.y, HELD.x);
    assert.deepEqual([frame.target.width, frame.target.height], [HELD.y, HELD.x]);
  } finally {
    frame.dispose();
  }
});
