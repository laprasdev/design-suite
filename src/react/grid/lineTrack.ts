import { D } from '../../synth/design/index.ts';

const { yesNoLine, fillGap } = D.moduleGrid;

/** A one-line row's own height: the pitch `yesNoLine` less the grid's `fillGap` between rows. What a line gives to
 *  press is this tall. */
export const ONE_LINE_HEIGHT = yesNoLine - fillGap;

/**
 * A module grid's row track: as tall as what the row holds, never a fixed least. A fixed least would be all a grid
 * whose height is set gives its rows, so a stacked knob's caption would draw over the row below; the one-line floor
 * is carried by the line itself (`FIELD_LINE`, a pressable name), so one-line rows still sit `yesNoLine` apart. Every
 * module grid lays its rows on it, so the pitch is the grid's, never a field's.
 */
export const LINE_TRACK = 'max-content';
