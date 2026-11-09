// A module on the four-column grid: its fixed size in the rack, and how it fills a page's tile.
// LayoutDimensions.moduleGrid is this, kept in its own file so layout.ts holds its size. Its fillColumnMax, which
// needs φ, is added there.

// A module's words: every field name, value and label on a page's module, and the owner's text floor.
export const MODULE_TEXT_SIZE = 12;
// The largest a knob on a page's module grows, which the grid's columns are measured against.
export const MODULE_CONTROL_MAX = 88;

export const ModuleGridDimensions = {
    columns: 4,
    rows: 2,
    cellWidth: 75,
    rowHeight: 76,
    sidePadding: 10,
    ringHeadroom: 16,
    footPadding: 0,
    tightLine: 1.15,
    fillPadding: 8,
    fillGap: 8,
    headerGap: 8,
    headerLineHeight: 29,
    headerTitleGap: 16,
    headerInset: 12,
    tabMinWidth: 18,
    tabMinHeight: 14,
    iconHeight: 14,
    tabIconHeight: 12,
    fieldGap: 6,
    fieldTextRoom: 44,
    controlShare: 0.85,
    controlMin: 44,
    controlMax: MODULE_CONTROL_MAX,
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
    // A yes/no field as one line: its dot, drawn at the name's size, then the name. The line is as tall as a module
    // header's, which is what it gives to press.
    yesNoDot: MODULE_TEXT_SIZE,
    yesNoStroke: 1.5,
    yesNoDash: 2,
    yesNoLine: 29,
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
    relationshipTypeColumns: 2,
    statesRowGap: 8,
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
    // A rail of kinds: wide enough for BLEND SHAPES on one line, an icon-over-name row, and the mode line.
    railWidth: 112,
    railRowMin: 44,
    railLine: 4,
} as const;
