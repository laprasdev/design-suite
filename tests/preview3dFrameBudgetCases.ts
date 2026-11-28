// What the frame budget's tests share (preview3dFrameBudget.test.ts, preview3dStageFailure.browser.test.ts).
import * as THREE from 'three';
import {MODEL_LINEAR_FRAME_TEXT} from '../src/react/preview3d/linearFrame.ts';
import {MODEL_STAGE} from '../src/react/preview3d/model.ts';

// The bytes per drawing-buffer pixel from the formats' sizes, written here, not read from the frame (perf-budgets'
// measured.md, Stage, "The stage's linear frame", beside the GPU process's readings): the frame alone, and with the
// scene depth's target, an 8-bit mask and 24-bit depth (stored in 4), single sampled, 5 more.
const PIXEL_BYTES = Object.freeze({frame: 60, withSceneDepth: 65});
// A 1080p screen at the stage's pixel-ratio limit, which the frame alone holds, and a 5K drawing buffer, which it
// refuses.
export const HELD = new THREE.Vector2(1920, 1080).multiplyScalar(MODEL_STAGE.pixelRatioLimit);
export const OVER = new THREE.Vector2(5120, 2880);
// With the scene depth's target: a 1440p drawing buffer is held, and a 1080p screen at the pixel-ratio limit refused.
export const DEPTH_HELD = new THREE.Vector2(2560, 1440);
export const DEPTH_OVER = HELD;
/** The refusal of a drawing buffer of this size for the frame as it is held, word for word. */
export const budgetRefusal = ({x, y}: THREE.Vector2, held: keyof typeof PIXEL_BYTES) =>
  MODEL_LINEAR_FRAME_TEXT.budget(x, y, x * y * PIXEL_BYTES[held], MODEL_STAGE.frameBytesLimit);
