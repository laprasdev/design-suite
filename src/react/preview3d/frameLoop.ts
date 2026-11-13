// The stage's frame loop, with no renderer: one step a frame until it is stopped. A step that throws stops the loop and
// goes to the stage's error route once, so a frame never ends the loop silently and a failed stage draws nothing more
// (a program three cannot build fails inside a frame's draw, WebGLRenderer.js 2086; the stage builds what it can in
// the staged build, draw.ts `compile`, so this is the route for what it could not foresee). Per frame it makes nothing.
/** How the loop asks for its next frame: the page's animation frames, or a test's. */
export interface ModelFrameScheduler {
  request(step: (now: number) => void): number;
  cancel(handle: number): void;
}
export const MODEL_PAGE_FRAMES: ModelFrameScheduler = Object.freeze({
  request: (step: (now: number) => void) => requestAnimationFrame(step),
  cancel: (handle: number) => cancelAnimationFrame(handle),
});

export function createModelFrameLoop(step: (now: number) => void, fail: (error: unknown) => void,
  frames: ModelFrameScheduler) {
  let handle = 0, running = false;
  const tick = (now: number) => {
    try {
      step(now);
    } catch (error) {
      running = false;
      fail(error);
      return;
    }
    if (running) handle = frames.request(tick);
  };
  return {
    start() {running = true; handle = frames.request(tick);},
    stop() {running = false; frames.cancel(handle);},
  };
}
