// A module on the four-column grid: its fixed size in the rack, and how it fills a page's tile.
// LayoutDimensions.moduleGrid is this, kept in its own file so layout.ts holds its size.
import { PHI, PHI_INVERSE, PHI_SQUARED } from './goldenRatio.ts';

// The owner's text floor, and a module's words: every field name, value and label on a page's module is drawn at it
// on the design stage, and nothing a page draws is smaller on screen at any window size.
export const TEXT_FLOOR = 10;
// An icon choice's square, φ of a module's words, and its glyph, the square over φ: never under a module's words.
export const ICON_CHOICE_BOX = Math.ceil(TEXT_FLOOR * PHI), ICON_CHOICE_GLYPH = ICON_CHOICE_BOX / PHI;
// A knob on a page's module: one golden step below the 88 px it was first drawn at, as the owner asked, and one more
// step below that at the least.
const MODULE_KNOB = 88 / PHI;
const MODULE_KNOB_MAX = Math.round(MODULE_KNOB);
const MODULE_KNOB_MIN = Math.round(MODULE_KNOB / PHI);
// A page's column grows with its tile only so far, so a few fields stay together across a wide tile: two golden steps
// above its largest knob.
const MODULE_COLUMN_MAX = Math.round(MODULE_KNOB * PHI_SQUARED);
// A module header's line, and the pitch every one-line row of a module keeps: a row is as tall as a header.
const HEADER_LINE = 29;
// The compact density's cell inset, the one a dense strip and a page's module both keep.
export const CELL_PAD_V = 4, CELL_PAD_H = 6;

export const ModuleGridDimensions = {
    columns: 4,
    rows: 2,
    cellWidth: 75,
    rowHeight: 76,
    sidePadding: 10,
    ringHeadroom: 16,
    footPadding: 0,
    tightLine: 1.15,
    fillPadding: CELL_PAD_H,
    fillGap: 8,
    headerGap: 8,
    headerLineHeight: HEADER_LINE,
    headerTitleGap: 16,
    headerInset: 12,
    tabMinWidth: 18,
    tabMinHeight: 14,
    iconHeight: 14,
    tabIconHeight: 12,
    fieldGap: 6,
    fieldTextRoom: 44,
    controlMin: MODULE_KNOB_MIN,
    fillColumnMax: MODULE_COLUMN_MAX,
    // A knob takes φ⁻¹ of its column's room, one golden step below it, within its two sizes.
    controlShare: PHI_INVERSE,
    controlMax: MODULE_KNOB_MAX,
    knobDragPx: 200,
    // A whole-number field, like a frame count, moves at most this many per pixel dragged, so it can be dragged
    // onto any value.
    wholeStepsPerPixel: 1,
    optionColumns: 3,
    optionGap: 4,
    optionPaddingBlock: 6,
    optionPaddingInline: 4,
    rowLabelWidth: 56,
    rowValueWidth: 96,
    rowGap: 16,
    // A range row's low or high value beside its track: wide enough for a number to two decimals.
    rowEndWidth: 40,
    phaseGlyphHeight: 12,
    nameIconHeight: 12,
    // A yes/no field as one line: its dot, drawn at the name's size, then the name. One-line rows sit `yesNoLine`
    // apart; what a line gives to press is that pitch less `fillGap` (lineTrack.ts owns it).
    yesNoDot: TEXT_FLOOR,
    yesNoStroke: 1.5,
    yesNoDash: 2,
    yesNoLine: HEADER_LINE,
    nameIconGap: 4,
    headerControlsPadding: 8,
    noticePadding: 12,
    detailLineGap: 12,
    detailDepthDragPx: 180,
    bodyGap: 12,
    columnGap: 12,
    rulesIndent: 16,
    choiceOptionsMax: 6,
    groupGap: 4,
    groupPaddingBlock: 3,
    groupPaddingInline: 8,
    groupStripPadding: 8,
    curveWidth: 96,
    curveHeight: 40,
    curveLine: 1.5,
    openButtonWidth: 44,
    openButtonHeight: 20,
    swatchHeight: 24,
    swatchWidth: 44,
    ringNumeralSize: 12,
    crumbGap: 8,
    gesturePhaseHeight: 20,
    gestureColumnWidth: 200,
    toolIconHeight: 20,
    layerBits: 32,
    layerColumns: 8,
    numberInputWidth: 88,
    sensorReachMeters: 5,
    // A sensor's distance moves in centimetres, the two decimals it reads in, so what's written is what shows.
    sensorDistanceStep: 0.01,
    inputPadding: 4,
    // A rail of kinds: its width and its mode line. Its rows are group rows (ModuleGroups' GROUP_ROW).
    railWidth: 112,
    railLine: 4,
} as const;
