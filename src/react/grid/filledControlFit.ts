import { ModuleGridDimensions as G } from '../../moduleGridLayout.ts';

export interface FilledControlFit {
  readonly size: number;
  readonly beside: boolean;
}

const clamp = (value: number, lowest: number, highest: number) => Math.min(highest, Math.max(lowest, value));

const knobIn = (room: number) =>
  clamp(Math.round(Math.min(G.fillColumnMax, room) * G.controlShare), G.controlMin, G.controlMax);

/**
 * A knob's size in a filled grid, and whether its caption sits beneath it or beside it, chosen by the room the grid is
 * given. One law sizes the knob: a φ step of the room left for it, which is the whole column when the caption goes
 * beneath, and the column less the caption, no more than a row, when it goes beside. A single-column narrow grid
 * always places captions beside; wider grids stack captions beneath only where the column holds the caption and each
 * row holds the knob with its caption under it.
 */
export function filledControlFit(
  width: number, height: number, columns: number, rows: number, caption: number,
): FilledControlFit {
  const columnRoom = (width - G.fillPadding * 2 - G.fillGap * (columns - 1)) / columns;
  const rowRoom = (height - G.fillPadding * 2 - G.fillGap * (rows - 1)) / rows;
  const stacked = knobIn(columnRoom);
  const beside = columns === 1 || rowRoom < stacked + G.fieldTextRoom || columnRoom < caption;
  return { size: beside ? knobIn(Math.min(columnRoom - G.fieldGap - caption, rowRoom)) : stacked, beside };
}
