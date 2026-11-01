// =====================================================
// DESIGN SYSTEM - Re-exports from ./design folder
// This file exists for backwards compatibility
// New code should import directly from './design/index.ts'
// =====================================================

export * from './design/index.ts';

// Legacy aliases for existing code during migration
export { LayoutDimensions as LAYOUT_DIMENSIONS } from './design/index.ts';
export { Shadows as SHADOWS } from './design/index.ts';
export { Typography as TYPOGRAPHY } from './design/index.ts';
export { LayoutDimensions, D, S, T, O, F, U, P, C, LayoutAPI } from './design/index.ts';

// Legacy flat aliases
import { LayoutDimensions, Typography, Shadows } from './design/index.ts';

export const LAYOUT = {
  maxContentWidth: LayoutDimensions.viewport.maxContentWidth,
  windowPadding: LayoutDimensions.spacing.windowPadding,
  modulePadding: LayoutDimensions.spacing.modulePadding,
  cutoutPadding: LayoutDimensions.spacing.cutoutPadding,
  rowGap: LayoutDimensions.spacing.rowGap,
  itemGap: LayoutDimensions.spacing.itemGap,
  sectionGap: LayoutDimensions.spacing.sectionGap
} as const;

export const RADIUS = {
  module: LayoutDimensions.radius.module,
  cutout: LayoutDimensions.radius.cutout,
  button: LayoutDimensions.radius.button,
  knob: LayoutDimensions.radius.knob
} as const;

export const SIZES = {
  knob: {
    small: LayoutDimensions.sizes.knobSmall,
    medium: LayoutDimensions.sizes.knobMedium,
    large: LayoutDimensions.sizes.knobLarge
  },
  button: {
    height: LayoutDimensions.sizes.buttonHeight,
    minWidth: LayoutDimensions.sizes.buttonMinWidth
  },
  boolean: {
    small: LayoutDimensions.sizes.booleanSmall,
    medium: LayoutDimensions.sizes.booleanMedium,
    large: LayoutDimensions.sizes.booleanLarge
  },
  toggle: {
    small: LayoutDimensions.sizes.toggleSmall,
    medium: LayoutDimensions.sizes.toggleMedium,
    large: LayoutDimensions.sizes.toggleLarge
  }
} as const;

export const TIMING = {
  fast: LayoutDimensions.timing.fast,
  normal: LayoutDimensions.timing.normal,
  slow: LayoutDimensions.timing.slow,
  oscillate: LayoutDimensions.timing.oscillateNormal
} as const;
