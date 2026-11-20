// What the filled grid test renders (filledGridScene.tsx) and measures: a page grid with a knob and fixed-height cells
// in a host the test resizes across widths and heights, once with no row that grows and once with one that does.
import {PHI, PHI_INVERSE, PHI_SQUARED} from '../src/goldenRatio.ts';
import {element} from '../src/react/elementContract.ts';

// The 88 px knob a page first drew: a page's widest column steps one φ below it, and its narrowest steps one φ more.
const FORMER_PAGE_KNOB = 88;
const MID_WIDTH = 320, MID_COLUMN_ROOM = 70;

export const FilledGridHost = element('filled-grid-host');
export const FilledGridCell = element('filled-grid-cell');
export const FILLED_GRID = Object.freeze({
  rows: 3, cellHeight: 60, heights: Object.freeze([200, 800]),
  widths: Object.freeze([
    {name: 'widest column', width: 700, knob: Math.round(FORMER_PAGE_KNOB / PHI)},
    {name: 'mid column', width: MID_WIDTH, knob: Math.round(MID_COLUMN_ROOM * PHI_INVERSE)},
    {name: 'narrowest column', width: 200, knob: Math.round(FORMER_PAGE_KNOB / PHI_SQUARED)},
  ]),
});
export interface FilledGridCase {readonly name: string; readonly growRows: readonly number[]}
export const FILLED_GRID_CASES: readonly FilledGridCase[] = Object.freeze([
  {name: 'no growing row', growRows: []},
  {name: 'second row grows', growRows: [2]},
]);
