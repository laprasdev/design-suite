// The frame's GPU memory is a budget (`MODEL_STAGE.frameBytesLimit`): a drawing buffer whose frame would pass it is
// refused by name, at creation and at every resize, naming its size, its bytes and how far over; a refused resize
// leaves the frame at the size it had.
import assert from 'node:assert/strict';
import {it} from 'node:test';
import {createModelLinearFrame} from '../src/react/preview3d/linearFrame.ts';
import {ModelStageRefusal} from '../src/react/preview3d/refusal.ts';
import {budgetRefusal, HELD, OVER} from './preview3dFrameBudgetCases.ts';

const refused = (size: typeof OVER) => (error: unknown) => error instanceof ModelStageRefusal &&
  error.message === budgetRefusal(size);

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
