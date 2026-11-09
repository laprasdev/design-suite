import type {CSSProperties, HTMLAttributes} from 'react';

/** How much larger than its line the live position draws. */
export const LIVE_SCALE = 2.4;

/** The attributes each part of a slider's modulation carries, which the checks and the pages that embed a slider find
 *  them by. A SOURCE is everything one source draws, valued by the source's key, and a LINE the row it draws as in the
 *  lines form; a SEGMENT is a stretch of a blended line, an END a circle or tip where a source stops, and its ORDER
 *  its source's place among the slider's modulators. A SOCKET is the target a control assigns sources through, and
 *  ASSIGNED marks one that holds any. */
export const ModulationPart = Object.freeze({
  SOURCE: 'data-modulator', LINE: 'data-modulation-source-line', SEGMENT: 'data-modulation-segment',
  END: 'data-modulation-end', LIVE: 'data-modulation-live', NUMERAL: 'data-modulator-numeral',
  SOCKET: 'data-modulation-socket', ORDER: 'data-modulation-order', ASSIGNED: 'data-modulation-assigned',
} as const);

const stop = (event: {stopPropagation(): void}) => event.stopPropagation();
interface Part {attributes: HTMLAttributes<HTMLElement>; style: CSSProperties}
/** What a source's part of the drawing is. Where nothing can be selected it is inert: it takes no pointer, so a press
 *  on it lands on the control beneath, and it is hidden from assistive technology. Where a source can be selected it
 *  is a button, and selecting never starts a value drag. */
export function sourcePart(onSelectSource: ((source: string) => void) | undefined, source: string,
  name: string): Part {
  if (!onSelectSource) return {attributes: {'aria-hidden': true}, style: {pointerEvents: 'none'}};
  const select = () => onSelectSource(source);
  return {style: {pointerEvents: 'auto', cursor: 'pointer'}, attributes: {
    role: 'button', tabIndex: 0, 'aria-label': name, onPointerDown: stop, onMouseDown: stop,
    onClick: event => {stop(event); select();},
    onKeyDown: event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      stop(event);
      select();
    },
  }};
}
