// The stage's frame loop, with no renderer: one step a frame until it is stopped. It owns the stage's one failure
// route, `fail`: the loop stops, so a failed stage draws nothing more, and `report` hears the error. A step that throws
// takes it, so a frame never ends the loop silently (a program three cannot build fails inside a frame's draw,
// WebGLRenderer.js 2086; the stage builds what it can in the staged build, draw.ts `compile`, so this is the route for
// what it could not foresee); so does a failure outside a frame, such as a resize the frame's budget refuses. Per frame
// it makes nothing.
/** How the loop asks for its next frame: the page's animation frames, or a test's. */
export interface ModelFrameScheduler {
  request(step: (now: number) => void): number;
  cancel(handle: number): void;
}
export const MODEL_PAGE_FRAMES: ModelFrameScheduler = Object.freeze({
  request: (step: (now: number) => void) => requestAnimationFrame(step),
  cancel: (handle: number) => cancelAnimationFrame(handle),
});

export function createModelFrameLoop(step: (now: number) => void, report: (error: unknown) => void,
  frames: ModelFrameScheduler) {
  let handle = 0, running = false;
  const stop = () => {running = false; frames.cancel(handle);};
  const fail = (error: unknown) => {stop(); report(error);};
  const tick = (now: number) => {
    try {step(now);} catch (error) {fail(error);}
    if (running) handle = frames.request(tick);
  };
  return {start() {running = true; handle = frames.request(tick);}, stop, fail};
}
