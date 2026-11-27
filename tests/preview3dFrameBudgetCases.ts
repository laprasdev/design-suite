// What the frame budget's tests share (preview3dFrameBudget.test.ts, preview3dStageFailure.browser.test.ts).
import * as THREE from 'three';
import {MODEL_LINEAR_FRAME_TEXT} from '../src/react/preview3d/linearFrame.ts';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';

// The bytes per drawing-buffer pixel from the formats' sizes, written here, not read from the frame (perf-budgets'
// measured.md, Stage, "The stage's linear frame", beside the GPU process's readings).
const PIXEL_BYTES = 60;
// A 1080p screen at the stage's pixel-ratio limit, which the placeholder holds, and a 5K drawing buffer, which it
// refuses.
export const HELD = new THREE.Vector2(1920, 1080).multiplyScalar(MODEL_STAGE.pixelRatioLimit);
export const OVER = new THREE.Vector2(5120, 2880);
/** The refusal of a drawing buffer of this size, word for word. */
export const budgetRefusal = ({x, y}: THREE.Vector2) =>
  MODEL_LINEAR_FRAME_TEXT.budget(x, y, x * y * PIXEL_BYTES, MODEL_STAGE.frameBytesLimit);
