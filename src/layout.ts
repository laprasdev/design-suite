// =====================================================
// LAYOUT DIMENSIONS - All numeric constants
// =====================================================

// Golden ratio constants
export const PHI = 1.618033988749895;
export const PHI_INVERSE = 0.618033988749895; // 1 / PHI
export const PHI_SQUARED = 2.618033988749895; // PHI * PHI
export const PHI_CUBED = PHI_SQUARED * PHI;

// // Golden ratio percentages for layouts
export const Relativity = {
  PhiInverse: 0.618, // ~61.8% - larger portion
  OneMinusPhiInverse: 0.382,
} as const;

export const LayoutDimensions = {
  // Viewport
  viewport: {
    maxContentWidth: 1824,  // 1920 - (48 * 2)
    minHeightVh: 100
  },
  
  // Spacing (in pixels)
  spacing: {
    windowPadding: 48,
    windowPaddingVertical: 32,
    modulePadding: 16,
    cutoutPadding: 12,
    sectionGap: 24,
    rowGap: 16,
    itemGap: 12,
    tightGap: 8,
    hairlineGap: 2,
    microGap: 4,
    nodeGap: 20,
    controlGap: 40
  },
  
  // Border radii
  radius: {
    module: 8,
    cutout: 6,
    button: 4,
    knob: 4,
    tiny: 2,
    node: 8
  },
  
  // Knob visual properties
  knob: {
    // Stroke widths (arc thickness)
    strokeThin: 1.5,
    strokeNormal: 2,
    strokeThick: 3,
    strokeHeavy: 4,
    // Glow radii
    glowSmall: 4,
    glowLarge: 8,
    // Hover glow
    hoverGlow: 12,
    // Tick glow (for DualTickRangeKnob)
    tickGlowActive: 6,
    tickGlowInactive: 3,
    // Inner padding by size tier
    innerPaddingMini: 5,
    innerPaddingCompact: 6,
    innerPaddingStandard: 8,
    innerPaddingLarge: 10,
    // Indicator dimensions
    indicatorWidthSmall: 3,
    indicatorWidthLarge: 4,
    indicatorHeightSmall: 6,
    indicatorHeightLarge: 8
  },

  // Component sizes
  sizes: {
    // Knobs
    knobSmall: 32,
    knobMedium: 46,
    knobLarge: 70,
    knobDetailedDefault: 75,
    
    // Buttons
    buttonHeight: 32,
    buttonMinWidth: 80,
    nesButtonWidth: 90,
    nesButtonHeight: 14,
    
    // Toggles
    toggleSmall: 10,
    toggleMedium: 14,
    toggleLarge: 18,
    
    // Booleans
    booleanMicro: 10,
    booleanSmall: 16,
    booleanMedium: 24,
    booleanLarge: 32,

    // Enum minimum dimensions
    enumMinWidth: 40,
    enumMinHeight: 40,
    
    // Icons
    iconTiny: 10,
    iconSmall: 12,
    iconMedium: 16,
    iconLarge: 20,

    // Scroll
    arrowWidth: 12,
    scrollSpeed: 3,
    scrollInterval: 16,

    // Nodes
    nodeMinWidth: 180,
    nodeMaxWidth: 280,

    // Node canvas
    canvasMinHeight: 650,
    addButtonSize: 40,
    addButtonOffset: 100,
    portSize: 12,
    terminalPadding: 12,
    
    // Graphs
    graphHeightSmall: 100,
    graphHeightMedium: 140,
    graphHeightLarge: 180,

    // Lifecycle strip layout
    graphMinHeight: 80,
    stripHeight: 56,
    phaseWaveSize: 12,

    // Page-level UI
    moduleToggle: 20,
    settingsToggle: 22,
    toolbarHeight: 24,
    pickerMaxHeight: 320,
    pickerMinWidth: 220,
    floppyIcon: 12,
  },
  
  // Animation timing (in milliseconds)
  timing: {
    instant: 0,
    fast: 100,
    normal: 200,
    slow: 300,
    verySlow: 600,
    oscillateFast: 400,
    oscillateNormal: 600,
    oscillateSlow: 1000,
    cycleDuration: 3000
  },
  
  // Accent line heights
  accent: {
    thin: 1,
    thick: 3,
  },

  // Strip cell size tiers (square for single-char, taller for complex)
  cellSize: {
    small: 18,   // single char (1, X, Y, Z)
    medium: 24,  // action glyph (+, icons)
    large: 32,   // multi-line content
  },

  // Grid
  grid: {
    moduleColumns: 2
  },

  // The synth's page shell: the screen it's drawn for, and how it fits smaller ones
  pageShell: {
    stageWidth: 1920,
    stageHeight: 1080,
    stageZoomMin: 0.8,
    tileGutter: 3,
    moduleWidth: 320,
    moduleHeight: 194,
    envelopeMinWidth: 453,
    envelopeMinHeight: 255,
    previewMinWidth: 280,
    previewMinHeight: 157,
    scrollCueHeight: 18,
    scrollCueIcon: 12,
    barLineHeight: 1.4,
    guideText: 12,
    guideTagLayer: 1,
    // A closed page's card: one drawing laid out on φ in the larger card's box, drawn smaller in the smaller card.
    // Text and icons stay these sizes in stage pixels in both, so they read at the smallest zoom; everything else is in the larger card's pixels.
    cardTitle: 14,
    cardText: 13,
    cardIcon: 14,
    cardPadding: 8,
    cardStroke: 1.5,
    cardWire: 1,
    cardGateRadius: 9,
    cardNodeRadius: 3,
    // The dash of a line a card draws for what the state takes from elsewhere, such as an Envelope phase that inherits.
    cardDash: 3,
    // What a drawing weighs against a list when a card shares its room out, in text rows; and the narrowest a list's column gets, in stage pixels.
    cardDrawingRows: 4,
    cardLineWidth: 120,
    // A card's title and live mark beside its drawing, when there they leave it more room than above it.
    cardHeaderWidth: 104,
    guideRemeasureMs: 1000,
    guideClipSlack: 1,
    overlayLayer: 2000,
    // A flip: twice the suite's .17s, long enough to watch a page and its card trade places around the still Preview.
    flipMs: 340,
    flipEase: 'cubic-bezier(.22,1,.36,1)',
    // The first half of a flip: the card you pressed fades as its page grows out of it, and the card taking its place waits for it to go.
    // In the second half that card slides in and the page you left hands over to its own card as it fades in.
    flipCardFadeDelayMs: 170,
    flipLeavingLayer: 1,
    // A card sliding to its new place passes under the arriving page's modules, over the page leaving.
    flipCardLayer: 1,
    flipArrivingLayer: 2,
    frameLayer: 3,
    arrangeLayer: 6,
    // Arranging: how near a tile's edge a drop cuts in, what a gutter takes the mouse over, and where a cut can rest, so a layout stays on the ratio.
    dropEdgeZone: 36,
    gutterHit: 10,
    gutterLine: 2,
    arrangeText: 13,
    cutStops: [(1 - PHI_INVERSE) * PHI_INVERSE, 1 - PHI_INVERSE, PHI_INVERSE, 1 - (1 - PHI_INVERSE) * PHI_INVERSE],
    // The smallest window an arrangement has to stay usable in, whichever window it's made in.
    smallestWindowWidth: 1366,
    smallestWindowHeight: 650,
  },

  // A module on the four-column grid: its fixed size in the rack, and how it fills a page's tile
  moduleGrid: {
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
    tabIconHeight: 20,
    fieldGap: 6,
    fieldTextRoom: 44,
    controlShare: 0.85,
    controlMin: 44,
    controlMax: 88,
    switchShare: 0.3,
    switchMin: 12,
    switchMax: 26,
    knobDragPx: 200,
    optionColumns: 3,
    optionGap: 4,
    optionPaddingBlock: 6,
    optionPaddingInline: 4,
    rowLabelWidth: 56,
    rowValueWidth: 96,
    rowGap: 16,
    headerSwitchHeight: 14,
    phaseGlyphHeight: 14,
    nameIconHeight: 12,
    // A yes/no field as one line: its dot, drawn at the name's size, then the name. The line is as tall as a module header's, which is what it gives to press.
    yesNoDot: 12,
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
    inputPadding: 4,
  },

  // The Envelope module on a page: four phase cells over the graph, the graph taking φ of what's left.
  envelope: {
    cellGap: 6,
    cellPadding: 8,
    cellRowGap: 6,
    pickerSize: 26,
    pickerGlyph: 18,
    enableLine: 2,
    // What a phase's on and off line gives to press: its foot of the cell, kept clear of what's above.
    enableHit: 13,
    boostIcon: 16,
    boostCell: 19,
    cellFloor: 0.05,
    plotBand: 34,
    frameLabelWidth: 48,
    gridLines: 4,
    scaleLineRoom: 20,
    curveSamples: 48,
    graphStroke: 1.5,
    graphGlow: 3,
    gridLine: 1,
    labelLine: 1.3,
    modulationPopoverWidth: 280,
    modulationPopoverGap: 4,
    modulationDepthReach: 10,
    modulationDragPx: 180,
  },

  // The Routing module on a page: cards on a canvas that pans, and the outputs in a column of their own.
  routing: {
    nodeWidth: 178,
    nodeHeader: 24,
    nodeRow: 30,
    nodePadding: 6,
    nodeRadius: 8,
    columnGap: 34,
    rowGap: 13,
    // A chain wider than the canvas wraps into bands this far apart, room enough for a wire going back to the next band's start.
    bandGap: 55,
    // Between the canvas's edge and the outputs, so a wire cut off at the edge never reads as reaching an output.
    edgeGap: 13,
    // How long a node that a reference opened stays marked.
    markMs: 1600,
    canvasInset: 21,
    canvasEnd: 34,
    portSize: 12,
    operatorSize: 24,
    wireBend: 55,
    wireWidth: 2,
    wireDash: 5,
    portStroke: 2,
    gridStep: 21,
    gridLine: 1,
    outputColumnWidth: 200,
    outputRow: 30,
    outputNameWidth: 32,
    outputPadding: 8,
    terminalSize: 10,
    menuWidth: 233,
    menuOffset: 8,
    panCueSize: 21,
    panCueIcon: 14,
    panStep: 0.8,
    moveSlack: 3,
    minWidth: 480,
    minHeight: 320,
  },

} as const;

// Compact spacing — dense synthesizer strip UI
const CELL_PAD_V = 4;
const CELL_PAD_H = 6;

export const CompactDimensions = {
  sectionGap: 4,
  itemGap: 2,
  modulePadding: 4,
  rowGap: 3,
  tightGap: 1,
  wideGap: 8,
  barGroupGap: 32,
  cellPadV: CELL_PAD_V,
  cellPadH: CELL_PAD_H,
  cellPad: `${CELL_PAD_V}px ${CELL_PAD_H}px`,
  clusterPad: '6px 8px',
  arrowWidth: LayoutDimensions.sizes.arrowWidth,
  scrollSpeed: LayoutDimensions.sizes.scrollSpeed,
  scrollInterval: LayoutDimensions.sizes.scrollInterval,
} as const;

// Universal scale factor
export let SCALE = 1;
export const sc = (v: number) => Math.round(v * SCALE);
export function setScale(s: number) { SCALE = s; }

export type LayoutDimensionsType = typeof LayoutDimensions;
export type CompactDimensionsType = typeof CompactDimensions;
