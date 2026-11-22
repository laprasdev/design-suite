// =====================================================
// AESTHETIC STYLES - All visual style constants
// =====================================================

import { LayoutDimensions } from './layout.ts';
import { TEXT_FLOOR } from './moduleGridLayout.ts';

// =====================================================
// SHADOWS
// =====================================================
export const Shadows = {
  // Module outer shadow - gives depth and separation from background
  moduleOuter: '0 4px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  
  // Cutout inset shadow - deep recessed feel for inputs
  cutoutInset: 'inset 0 2px 8px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.03)',
  
  // Button inset shadow - subtle pressed feel
  buttonInset: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
  
  // Glow generator - for active/selected states
  glow: (color: string, intensity: number = 1) => `0 0 ${12 * intensity}px ${color}`,
  
  // Combined shadow for panels (like settings)
  panelDeep: (shadowStyle: string) => `${shadowStyle}, 0 8px 32px rgba(0, 0, 0, 0.6)`,
  
  // Node shadow
  nodeElevated: '0 2px 8px rgba(0, 0, 0, 0.3)'
} as const;

// =====================================================
// TYPOGRAPHY
// =====================================================
// Every role draws at the one text size, `TEXT_FLOOR`: a role differs only by its weight and spacing,
// so a header is the same text given its heavier weight.
export { TEXT_FLOOR };

export const Typography = {
  caption: {
    fontSize: TEXT_FLOOR,
    fontWeight: 700,
    letterSpacing: '0.05em'
  },
  title: {
    fontSize: TEXT_FLOOR,
    fontWeight: 700,
    letterSpacing: '0.1em'
  },
  // A field's name, on a page's module and everywhere else.
  label: {
    fontSize: TEXT_FLOOR,
    fontWeight: 600,
    letterSpacing: '0.05em'
  },
  value: {
    fontSize: TEXT_FLOOR,
    fontWeight: 600,
    letterSpacing: '0.02em'
  },
  // A field's value on a page's module.
  moduleValue: {
    fontSize: TEXT_FLOOR,
    fontWeight: 500,
    letterSpacing: '0.02em'
  }
} as const;

// =====================================================
// OPACITY LEVELS
// =====================================================
export const Opacity = {
  full: 1,
  hover: 0.9,
  high: 0.8,
  medium: 0.6,
  half: 0.5,
  low: 0.4,
  dim: 0.3,
  subtle: 0.25,
  solid: 0.85,
  inactive: 0.2,
  faint: 0.15,
  trace: 0.12,
  ghost: 0.07,
} as const;

// =====================================================
// BORDER STYLES
// =====================================================
export const Borders = {
  standard: { width: 1, style: 'solid' as const },
  thick: { width: 2, style: 'solid' as const },
  none: { width: 0, style: 'none' as const }
} as const;

// =====================================================
// CONTAINER STYLE BUILDERS
// =====================================================
export const ContainerStyles = {
  module: {
    borderRadius: LayoutDimensions.radius.module,
    padding: LayoutDimensions.spacing.modulePadding,
    shadow: Shadows.moduleOuter,
    border: Borders.standard
  },
  
  cutout: {
    borderRadius: LayoutDimensions.radius.cutout,
    padding: LayoutDimensions.spacing.cutoutPadding,
    shadow: Shadows.cutoutInset,
    border: Borders.standard
  },
  
  button: {
    borderRadius: LayoutDimensions.radius.button,
    padding: LayoutDimensions.spacing.tightGap,
    shadow: Shadows.buttonInset,
    border: Borders.standard
  },
  
  node: {
    borderRadius: LayoutDimensions.radius.node,
    padding: LayoutDimensions.spacing.cutoutPadding,
    shadow: Shadows.nodeElevated,
    border: Borders.standard
  }
} as const;

export type ShadowsType = typeof Shadows;
export type TypographyType = typeof Typography;
export type OpacityType = typeof Opacity;
