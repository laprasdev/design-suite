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
