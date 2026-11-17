// One owner tells a press's tap, double-tap and drag apart: a press that lets go where it started taps once the
// double-tap interval passes with no second press, a second press in time makes a double-tap and no tap, and a press
// that moves past the slop is neither. The hook runs as a Component (renderedHooks.ts) and its handlers are pressed.
import assert from 'node:assert/strict';
import {after, afterEach, beforeEach, describe, it, mock} from 'node:test';
import {bundled, replacedHooks} from './bundled.ts';
import {Component, STATEFUL_HOOKS, rendered} from './renderedHooks.ts';

type Pointer = 'mouse' | 'touch';
interface Press {pointerType: Pointer; isPrimary: true; pointerId: number; clientX: number; clientY: number;
  timeStamp: number; target: object; preventDefault(): void; stopPropagation(): void}
interface Handlers {onPointerDown(event: Press): void; onPointerMove(event: Press): void;
  onPointerUp(event: Press): void; onDoubleClick(event: Press): void}
interface Options {onDoubleTap(): void; onTap(): void; accepts(): boolean; slop: number}
type Module = {useDoubleTap(options: Options): Handlers}
  & typeof import('../src/layout.ts');

const {module, dispose} = await bundled<Module>(['src/react/useDoubleTap.ts', 'src/layout.ts'],
  [replacedHooks(STATEFUL_HOOKS)]);
after(dispose);
const INTERVAL = module.LayoutDimensions.timing.slow, SLOP = module.LayoutDimensions.routing.moveSlack;
const QUICK = INTERVAL / 3;

describe('a press on a tap and double-tap target', () => {
  beforeEach(() => mock.timers.enable({apis: ['setTimeout']}));
  afterEach(() => mock.timers.reset());
  function target(pointerType: Pointer) {
    const heard = {taps: 0, doubleTaps: 0};
    const hook = new Component(() => module.useDoubleTap({slop: SLOP, accepts: () => true,
      onTap: () => heard.taps++, onDoubleTap: () => heard.doubleTaps++}));
    rendered(hook);
    let time = 0;
    const event = (x: number): Press => ({pointerType, isPrimary: true, pointerId: 1, clientX: x, clientY: 0,
      timeStamp: time, target: {}, preventDefault: () => undefined, stopPropagation: () => undefined});
    // A press that passes `through` on its way and lets go where it started.
    const press = (through = 0) => {
      hook.now.onPointerDown(event(0));
      time += QUICK; hook.now.onPointerMove(event(through)); hook.now.onPointerUp(event(0));
      time += QUICK;
    };
    const doubleClick = () => hook.now.onDoubleClick(event(0));
    const wait = () => {mock.timers.tick(INTERVAL); time += INTERVAL;};
    return {heard, press, doubleClick, wait};
  }

  it('taps once the double-tap interval passes, for a mouse and a touch', () => {
    for (const pointer of ['mouse', 'touch'] as const) {
      const {heard, press, wait} = target(pointer);
      press();
      assert.equal(heard.taps, 0, `a ${pointer} tapped before a second press could follow`);
      wait();
      assert.deepEqual(heard, {taps: 1, doubleTaps: 0}, pointer);
    }
  });

  it('neither taps nor double-taps when the press moves past the slop, even to let go where it started', () => {
    const {heard, press, wait} = target('mouse');
    press(SLOP + 1); wait();
    assert.deepEqual(heard, {taps: 0, doubleTaps: 0});
  });

  it('double-taps without tapping for two touches in time', () => {
    const {heard, press, wait} = target('touch');
    press(); press(); wait();
    assert.deepEqual(heard, {taps: 0, doubleTaps: 1});
  });

  it('double-taps without tapping for a mouse double-click', () => {
    const {heard, press, doubleClick, wait} = target('mouse');
    press(); press(); doubleClick(); wait();
    assert.deepEqual(heard, {taps: 0, doubleTaps: 1});
  });
});
