// =====================================================
// KNOB CONFIGURATION - Config-based knob system
// Eliminates magic variant strings in favor of composable config
// =====================================================

import { LayoutDimensions } from '../../../layout.ts';

// =====================================================
// KNOB SIZES - Numeric pixel values
// =====================================================
export const KnobSize = {
  /** Smallest knob (32px) - for compact controls like range min/max */
  MINI: LayoutDimensions.sizes.knobSmall,
  /** Compact knob (40px) - for dense layouts */
  COMPACT: 40,
  /** Standard knob (46px) - default size for most controls */
  STANDARD: LayoutDimensions.sizes.knobMedium,
  /** Large knob (60px) - for prominent controls */
  LARGE: 60,
  /** Detailed knob (75px) - for primary controls with ticks */
  DETAILED: LayoutDimensions.sizes.knobDetailedDefault
} as const;

export type KnobSizeValue = typeof KnobSize[keyof typeof KnobSize];

// =====================================================
// KNOB STROKE WIDTHS - Arc line thickness
// =====================================================
export const KnobStroke = {
  /** Thin stroke - for mini/compact knobs */
  THIN: LayoutDimensions.knob.strokeNormal,
  /** Standard stroke - default for most knobs */
  STANDARD: LayoutDimensions.knob.strokeThick,
  /** Thick stroke - for detailed/large knobs */
  THICK: LayoutDimensions.knob.strokeHeavy
} as const;

export type KnobStrokeValue = typeof KnobStroke[keyof typeof KnobStroke];

// =====================================================
// KNOB VALUE TYPES - How values are interpreted
// =====================================================
export const KnobValueType = {
  /** Float 0-1 range - normalized value */
  FLOAT: 'float',
  /** Integer range - whole numbers with min/max */
  INTEGER: 'integer',
  /** Percentage - display as 0-100% */
  PERCENTAGE: 'percentage'
} as const;

export type KnobValueTypeValue = typeof KnobValueType[keyof typeof KnobValueType];

// =====================================================
// KNOB LAYOUT MODE - Label/value arrangement
// =====================================================
export const KnobLayout = {
  /** Vertical: knob on top, value below, label in cutout at bottom */
  VERTICAL: 'vertical',
  /** Horizontal: knob, value, label in a row */
  HORIZONTAL: 'horizontal',
  /** Knob only - no label or value displayed */
  KNOB_ONLY: 'knob-only'
} as const;

export type KnobLayoutValue = typeof KnobLayout[keyof typeof KnobLayout];

// =====================================================
// KNOB LABEL STYLE - How the label is rendered
// =====================================================
export const KnobLabelStyle = {
  /** Plain text label */
  PLAIN: 'plain',
  /** Label in cutout box */
  CUTOUT: 'cutout'
} as const;

export type KnobLabelStyleValue = typeof KnobLabelStyle[keyof typeof KnobLabelStyle];

// =====================================================
// KNOB FEATURE FLAGS - Optional visual features
// =====================================================
export const KnobFeature = {
  /** Show tick marks around the arc */
  TICKS: 'ticks',
  /** Show center dot on knob body */
  CENTER_DOT: 'centerDot',
  /** Show toggle button for enable/disable */
  TOGGLE: 'toggle'
} as const;

export type KnobFeatureValue = typeof KnobFeature[keyof typeof KnobFeature];

// =====================================================
// KNOB CONFIG INTERFACE - The unified config type
// =====================================================
export interface KnobConfig {
  /** Size in pixels (use KnobSize constants) */
  size: number;
  /** Arc stroke width (use KnobStroke constants) */
  stroke: KnobStrokeValue;
  /** How values are interpreted */
  valueType: KnobValueTypeValue;
  /** Label/value layout arrangement */
  layout: KnobLayoutValue;
  /** Label rendering style */
  labelStyle: KnobLabelStyleValue;
  /** Optional features to enable */
  features: Set<KnobFeatureValue>;
}

// =====================================================
// PRESET CONFIGS - Common configurations
// Consumers can use these or build custom configs
// =====================================================
export const KnobPreset = {
  /** Mini inline knob - compact, no ticks */
  mini: {
    size: KnobSize.MINI,
    stroke: KnobStroke.THIN,
    valueType: KnobValueType.FLOAT,
    layout: KnobLayout.VERTICAL,
    labelStyle: KnobLabelStyle.CUTOUT,
    features: new Set<KnobFeatureValue>()
  } satisfies KnobConfig,

  /** Standard control knob */
  standard: {
    size: KnobSize.STANDARD,
    stroke: KnobStroke.STANDARD,
    valueType: KnobValueType.FLOAT,
    layout: KnobLayout.VERTICAL,
    labelStyle: KnobLabelStyle.PLAIN,
    features: new Set<KnobFeatureValue>()
  } satisfies KnobConfig,

  /** Detailed knob with ticks and center dot */
  detailed: {
    size: KnobSize.DETAILED,
    stroke: KnobStroke.THICK,
    valueType: KnobValueType.FLOAT,
    layout: KnobLayout.VERTICAL,
    labelStyle: KnobLabelStyle.CUTOUT,
    features: new Set<KnobFeatureValue>([KnobFeature.TICKS, KnobFeature.CENTER_DOT])
  } satisfies KnobConfig,

  /** Integer knob with ticks */
  integer: {
    size: KnobSize.DETAILED,
    stroke: KnobStroke.THICK,
    valueType: KnobValueType.INTEGER,
    layout: KnobLayout.VERTICAL,
    labelStyle: KnobLabelStyle.CUTOUT,
    features: new Set<KnobFeatureValue>([KnobFeature.TICKS, KnobFeature.CENTER_DOT])
  } satisfies KnobConfig,

  /** Compact knob for dense layouts */
  compact: {
    size: KnobSize.COMPACT,
    stroke: KnobStroke.THIN,
    valueType: KnobValueType.FLOAT,
    layout: KnobLayout.HORIZONTAL,
    labelStyle: KnobLabelStyle.PLAIN,
    features: new Set<KnobFeatureValue>()
  } satisfies KnobConfig,

  /** Range knob for dual-tick min/max controls */
  range: {
    size: KnobSize.STANDARD,
    stroke: KnobStroke.STANDARD,
    valueType: KnobValueType.FLOAT,
    layout: KnobLayout.VERTICAL,
    labelStyle: KnobLabelStyle.CUTOUT,
    features: new Set<KnobFeatureValue>()
  } satisfies KnobConfig
} as const;

export type KnobPresetKey = keyof typeof KnobPreset;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/** Check if a feature is enabled in config */
export function hasFeature(config: KnobConfig, feature: KnobFeatureValue): boolean {
  return config.features.has(feature);
}

/** Create a custom config from a preset with overrides */
export function createKnobConfig(
  preset: KnobPresetKey,
  overrides?: Partial<Omit<KnobConfig, 'features'>> & { features?: KnobFeatureValue[] }
): KnobConfig {
  const base = KnobPreset[preset];
  const features = overrides?.features
    ? new Set<KnobFeatureValue>(overrides.features)
    : new Set(base.features);

  return {
    ...base,
    ...overrides,
    features
  };
}

/** Get derived dimensions from config */
export function getKnobDimensions(config: KnobConfig) {
  const { size, stroke } = config;
  const k = LayoutDimensions.knob;

  // Inner padding scales with size
  const innerPadding = size <= KnobSize.MINI ? k.innerPaddingMini
    : size <= KnobSize.COMPACT ? k.innerPaddingCompact
    : size <= KnobSize.STANDARD ? k.innerPaddingStandard
    : k.innerPaddingLarge;

  // Glow radius - keep generous for good hover feedback
  const glowRadius = size <= KnobSize.COMPACT ? k.glowSmall : k.glowLarge;

  // Stroke width caps for small knobs (arc dominates visually otherwise)
  const effectiveStroke = size <= KnobSize.MINI ? Math.min(stroke, k.strokeThin)
    : size <= KnobSize.COMPACT ? Math.min(stroke, k.strokeNormal)
    : stroke;

  const isSmall = size <= KnobSize.COMPACT;

  return {
    size,
    stroke: effectiveStroke,
    innerPadding,
    innerSize: size - (innerPadding * 2),
    glowRadius,
    hoverGlow: k.hoverGlow,
    indicatorWidth: isSmall ? k.indicatorWidthSmall : k.indicatorWidthLarge,
    indicatorHeight: isSmall ? k.indicatorHeightSmall : k.indicatorHeightLarge
  };
}

/** Get sensitivity based on config and range */
export function getKnobSensitivity(config: KnobConfig, range: number): number {
  if (config.valueType === KnobValueType.INTEGER) {
    return 0.5;
  }
  // Smaller knobs need more sensitivity
  if (config.size <= KnobSize.COMPACT) {
    return range * 0.01;
  }
  return 0.005;
}
