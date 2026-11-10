import {RESET_SIDE, RESET_STROKE} from './HeaderIconButton.tsx';

// Playback artwork shared by editors, players and simulation controls.
const CANVAS_WIDTH = 30, CANVAS_HEIGHT = 20;
const GLYPH_HEIGHT = 14, GLYPH_TOP = (CANVAS_HEIGHT - GLYPH_HEIGHT) / 2;
const ARROW_STEP = 10, COMPACT_TOP = 1;
const SQUARE_VIEW_BOX = `${(CANVAS_WIDTH - CANVAS_HEIGHT) / 2} 0 ${CANVAS_HEIGHT} ${CANVAS_HEIGHT}`;
// Match Reset's rendered stroke across both SVG canvases.
const BAR_WIDTH = CANVAS_HEIGHT * RESET_STROKE / RESET_SIDE;

function arrowPath(start: number, top: number): string {
  return `M${start} ${top}v${GLYPH_HEIGHT}l8-${GLYPH_HEIGHT / 2}z`;
}

export function PlaybackArrows({count, start, compact = false}: {count: number; start: number; compact?: boolean}) {
  const top = compact ? COMPACT_TOP : GLYPH_TOP;
  const height = compact ? GLYPH_HEIGHT + COMPACT_TOP * 2 : CANVAS_HEIGHT;
  return <svg viewBox={`0 0 ${CANVAS_WIDTH} ${height}`} aria-hidden="true">
    {Array.from({length: count}, (_, index) =>
      <path key={index} d={arrowPath(start + index * ARROW_STEP, top)} fill="currentColor"/>)}
  </svg>;
}

export const PlayIcon = () => <svg viewBox={SQUARE_VIEW_BOX} aria-hidden="true">
  <path d={arrowPath(11, GLYPH_TOP)} fill="currentColor"/>
</svg>;
export const FastForwardIcon = () => <PlaybackArrows count={2} start={5}/>;
export const SuperFastForwardIcon = () => <PlaybackArrows count={3} start={1}/>;
export const PauseIcon = () => <svg viewBox={SQUARE_VIEW_BOX} aria-hidden="true">
  <rect x="11" y={GLYPH_TOP} width={BAR_WIDTH} height={GLYPH_HEIGHT} rx={BAR_WIDTH / 2} fill="currentColor"/>
  <rect x="17" y={GLYPH_TOP} width={BAR_WIDTH} height={GLYPH_HEIGHT} rx={BAR_WIDTH / 2} fill="currentColor"/>
</svg>;
