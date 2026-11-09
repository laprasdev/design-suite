import {LayoutDimensions, PHI_SQUARED} from '../layout.ts';
import {reducedMotion} from './motion.ts';
import type {PageMotion} from './pageMotion.ts';

const {flipMs, flipEase} = LayoutDimensions.pageShell;
const HALF = 0.5, QUARTER_TURN = 90;

/** Each surface turns at its own size and position. Navigation and retained mounts belong to the caller. */
export function animateCardFlip(outgoing: readonly HTMLElement[], incoming: readonly HTMLElement[]): PageMotion {
  const animations: Animation[] = [];
  const turn = (element: HTMLElement, arriving: boolean) => {
    const depth = Math.max(element.clientWidth, element.clientHeight) * PHI_SQUARED;
    const frame = (angle: number, opacity: number, offset: number, easing: string = flipEase): Keyframe => ({
      transform: `perspective(${depth}px) rotateY(${angle}deg)`, transformOrigin: 'center',
      backfaceVisibility: 'hidden', opacity, offset, easing,
    });
    const frames = arriving
      ? [frame(QUARTER_TURN, 0, 0, 'steps(1,end)'), frame(QUARTER_TURN, 1, HALF), frame(0, 1, 1)]
      : [frame(0, 1, 0, 'ease-in'), frame(-QUARTER_TURN, 0, HALF), frame(-QUARTER_TURN, 0, 1)];
    animations.push(element.animate(frames, {duration: flipMs, fill: 'both'}));
  };
  if (!reducedMotion()) {
    outgoing.forEach(element => turn(element, false));
    incoming.forEach(element => turn(element, true));
  }
  const finished = Promise.all(animations.map(animation => animation.finished));
  finished.catch(() => {});
  return {finished, endsAt: performance.now() + (animations.length ? flipMs : 0),
    cancel: () => animations.forEach(animation => animation.cancel())};
}
