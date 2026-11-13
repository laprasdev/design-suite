import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {createModelFrameLoop, type ModelFrameScheduler} from '../src/react/preview3d/frameLoop.ts';

// A page's animation frames under the test's hand: each request is held until the test runs it.
function frames() {
  const queued: Array<(now: number) => void> = [], cancelled: number[] = [];
  let handles = 0;
  const scheduler: ModelFrameScheduler = {request: step => {queued.push(step); return ++handles;},
    cancel: handle => {cancelled.push(handle);}};
  const run = (now: number) => queued.shift()!(now);
  return {scheduler, queued, cancelled, run};
}

const unexpected = (error: unknown) => assert.fail(`no step fails here: ${String(error)}`);

describe('the stage\'s frame loop', () => {
  it('steps once a frame, asking for the next only after the step', () => {
    const page = frames(), steps: number[] = [];
    const loop = createModelFrameLoop(now => {steps.push(now); assert.equal(page.queued.length, 0);}, unexpected,
      page.scheduler);
    loop.start();
    page.run(16);
    page.run(33);
    assert.deepEqual(steps, [16, 33]);
    assert.equal(page.queued.length, 1);
    loop.stop();
    assert.deepEqual(page.cancelled, [3]);
  });

  it('stops at a step that throws and hands its error to the stage\'s error route once, drawing nothing more', () => {
    const page = frames(), failed: unknown[] = [], broken = new Error('kind program: no anchor');
    let steps = 0;
    const loop = createModelFrameLoop(() => {
      steps++;
      if (steps === 2) throw broken;
    }, error => failed.push(error), page.scheduler);
    loop.start();
    page.run(16);
    page.run(33);
    assert.deepEqual(failed, [broken]);
    assert.equal(page.queued.length, 0, 'no frame is asked for after the failure');
    assert.equal(steps, 2);
  });

  it('asks for no frame after it is stopped, even from a step already running', () => {
    const page = frames();
    let loop: ReturnType<typeof createModelFrameLoop> | undefined;
    loop = createModelFrameLoop(() => loop!.stop(), unexpected, page.scheduler);
    loop.start();
    page.run(16);
    assert.equal(page.queued.length, 0);
  });
});
