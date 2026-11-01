// =====================================================
// KEYS & PATHS - All string constants (CSS values, etc.)
// =====================================================

// =====================================================
// FLEXBOX KEYS
// =====================================================
export const FlexKeys = {
  // Display
  flex: 'flex',
  grid: 'grid',
  block: 'block',
  inlineFlex: 'inline-flex',
  none: 'none',
  
  // Direction
  row: 'row',
  column: 'column',
  rowReverse: 'row-reverse',
  columnReverse: 'column-reverse',
  
  // Justify
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
  
  // Align
  stretch: 'stretch',
  baseline: 'baseline'
} as const;

// =====================================================
// POSITION KEYS
// =====================================================
export const PositionKeys = {
  relative: 'relative',
  absolute: 'absolute',
  fixed: 'fixed',
  static: 'static',
  sticky: 'sticky'
} as const;

// =====================================================
// CURSOR KEYS
// =====================================================
export const CursorKeys = {
  pointer: 'pointer',
  grab: 'grab',
  grabbing: 'grabbing',
  notAllowed: 'not-allowed',
  default: 'default',
  move: 'move',
  crosshair: 'crosshair'
} as const;

// =====================================================
// TEXT TRANSFORM KEYS
// =====================================================
export const TransformKeys = {
  uppercase: 'uppercase',
  lowercase: 'lowercase',
  capitalize: 'capitalize',
  none: 'none'
} as const;

// =====================================================
// TRANSITION KEYS
// =====================================================
export const TransitionKeys = {
  none: 'none',
  fast: 'all 0.1s ease',
  normal: 'all 0.2s ease',
  slow: 'all 0.3s ease',
  cubic: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
} as const;

// =====================================================
// GRADIENT BUILDERS
// =====================================================
export const GradientKeys = {
  linear: (deg: number, ...stops: string[]) => `linear-gradient(${deg}deg, ${stops.join(', ')})`,
  radial: (...stops: string[]) => `radial-gradient(circle, ${stops.join(', ')})`
} as const;

// =====================================================
// UNIT BUILDERS
// =====================================================
export const Units = {
  px: (value: number) => `${value}px`,
  percent: (value: number) => `${value}%`,
  vh: (value: number) => `${value}vh`,
  vw: (value: number) => `${value}vw`,
  em: (value: number) => `${value}em`,
  rem: (value: number) => `${value}rem`
} as const;

// =====================================================
// COMMON STRINGS
// =====================================================
export const CommonStrings = {
  empty: '',
  space: ' ',
  auto: 'auto',
  inherit: 'inherit',
  transparent: 'transparent',
  hidden: 'hidden',
  visible: 'visible',
  scroll: 'scroll'
} as const;

export type FlexKeysType = typeof FlexKeys;
export type PositionKeysType = typeof PositionKeys;
export type CursorKeysType = typeof CursorKeys;
