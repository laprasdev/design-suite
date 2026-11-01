// =====================================================
// LAYOUT API - The ONLY file components should import
// Provides all style getters and constants
// =====================================================

import React from 'react';
import { LayoutDimensions, CompactDimensions } from '../../layout.ts';
import { Shadows, Typography, Opacity, ContainerStyles, Borders } from '../../tokens.ts';
import { FlexKeys, PositionKeys, CursorKeys, TransformKeys, TransitionKeys, Units, CommonStrings } from './KeysPaths.ts';
import type { StyleTheme } from '../StyleContext.tsx';
import { containerCSS } from './Composable.ts';
import { DisplayMode, type DisplayModeValue, ContainerType, type ContainerTypeValue, createBorder } from './constants/index.ts';

// Re-export everything for single import
export { LayoutDimensions, CompactDimensions, SCALE, sc, setScale } from '../../layout.ts';
export { Shadows, Typography, Opacity, ContainerStyles, Borders } from '../../tokens.ts';
export { FlexKeys, PositionKeys, CursorKeys, TransformKeys, TransitionKeys, Units, CommonStrings } from './KeysPaths.ts';
export { DisplayMode, ContainerType, createBorder } from './constants/index.ts';
export type { DisplayModeValue, ContainerTypeValue } from './constants/index.ts';

// =====================================================
// SHORTHAND ACCESSORS
// =====================================================
export const D = LayoutDimensions;  // Dimensions
export const S = Shadows;            // Shadows
export const T = Typography;         // Typography
export const O = Opacity;            // Opacity
export const F = FlexKeys;           // Flex
export const P = PositionKeys;       // Position
export const C = CursorKeys;         // Cursor
export const U = Units;              // Units

// =====================================================
// CONTAINER CONFIG - Single source of truth for container styling
// =====================================================
const CONTAINER_CONFIG: Record<ContainerTypeValue, {
  radius: number;
  padding: number;
  shadow: (theme: StyleTheme) => string;
}> = {
  [ContainerType.MODULE]: {
    radius: D.radius.module,
    padding: D.spacing.modulePadding,
    shadow: (t) => Shadows.panelDeep(t.shadowStyle)
  },
  [ContainerType.CUTOUT]: {
    radius: D.radius.cutout,
    padding: D.spacing.cutoutPadding,
    shadow: () => S.cutoutInset
  },
  [ContainerType.NODE]: {
    radius: D.radius.node,
    padding: D.spacing.cutoutPadding,
    shadow: () => S.nodeElevated
  },
  [ContainerType.BUTTON]: {
    radius: D.radius.button,
    padding: D.spacing.tightGap,
    shadow: () => S.buttonInset
  }
};

// =====================================================
// STYLE BUILDERS - Use these in components
// =====================================================
export const LayoutAPI = {
  // Unified container getter - ONE function for all container types
  // CUTOUT: gradient background + shadows + padding | FLAT: solid background, no shadows, no padding
  getContainer: (
    type: ContainerTypeValue,
    theme: StyleTheme,
    displayMode: DisplayModeValue = DisplayMode.CUTOUT
  ): React.CSSProperties => {
    const config = CONTAINER_CONFIG[type];
    const panel = type === ContainerType.MODULE || type === ContainerType.CUTOUT;
    const base = { borderRadius: panel ? 0 : config.radius };
    if (panel) return { ...base, padding: displayMode === DisplayMode.FLAT ? 0 : config.padding,
      background: theme.backgroundColor, border: createBorder(theme.borderColor), boxShadow: 'none',
      ...(theme.containers?.[type] ? containerCSS(theme.containers[type]) : {}) };

    return displayMode === DisplayMode.FLAT
      ? { ...base, background: theme.backgroundColor, border: createBorder(theme.borderColor) }
      : { ...base, padding: config.padding, background: theme.cutoutBackground, border: createBorder(theme.cutoutBorder), boxShadow: config.shadow(theme) };
  },

  // Convenience aliases (call getContainer internally)
  getModuleContainer: (theme: StyleTheme, displayMode: DisplayModeValue = DisplayMode.CUTOUT) =>
    LayoutAPI.getContainer(ContainerType.MODULE, theme, displayMode),

  getCutoutContainer: (theme: StyleTheme, displayMode: DisplayModeValue = DisplayMode.CUTOUT) =>
    LayoutAPI.getContainer(ContainerType.CUTOUT, theme, displayMode),

  getNodeContainer: (theme: StyleTheme, displayMode: DisplayModeValue = DisplayMode.CUTOUT) =>
    LayoutAPI.getContainer(ContainerType.NODE, theme, displayMode),

  // Button is special - has isActive state affecting colors
  getButtonContainer: (
    theme: StyleTheme,
    isActive: boolean = false,
    displayMode: DisplayModeValue = DisplayMode.CUTOUT
  ): React.CSSProperties => {
    const config = CONTAINER_CONFIG[ContainerType.BUTTON];
    const base: React.CSSProperties = {
      background: isActive ? theme.primaryColor : theme.backgroundColor,
      border: createBorder(isActive ? theme.primaryColor : theme.borderColor),
      borderRadius: config.radius,
      cursor: C.pointer,
      transition: TransitionKeys.normal
    };
    return displayMode === DisplayMode.FLAT
      ? base
      : { ...base, boxShadow: isActive ? S.glow(theme.primaryColor, O.medium) : config.shadow(theme) };
  },

  // Flex row
  flexRow: (gap?: number, justify?: string, align?: string): React.CSSProperties => ({
    display: F.flex,
    flexDirection: F.row as 'row',
    gap: gap ?? D.spacing.itemGap,
    justifyContent: justify ?? F.start,
    alignItems: align ?? F.center
  }),

  // Flex column
  flexColumn: (gap?: number, justify?: string, align?: string): React.CSSProperties => ({
    display: F.flex,
    flexDirection: F.column as 'column',
    gap: gap ?? D.spacing.rowGap,
    justifyContent: justify ?? F.start,
    alignItems: align ?? F.stretch
  }),

  // Grid
  grid: (columns: number, gap?: number): React.CSSProperties => ({
    display: F.grid,
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: gap ?? D.spacing.sectionGap
  }),

  // Window/page container
  windowContainer: (): React.CSSProperties => ({
    padding: `${D.spacing.windowPaddingVertical}px ${D.spacing.windowPadding}px`,
    minHeight: `${D.viewport.minHeightVh}vh`,
    maxWidth: D.viewport.maxContentWidth,
    margin: `0 ${CommonStrings.auto}`
  }),

  // Label text style
  labelStyle: (color: string): React.CSSProperties => ({
    fontSize: T.label.fontSize,
    fontWeight: T.label.fontWeight,
    letterSpacing: T.label.letterSpacing,
    textTransform: TransformKeys.uppercase as 'uppercase',
    color
  }),

  // Value text style
  valueStyle: (color: string): React.CSSProperties => ({
    fontSize: T.value.fontSize,
    fontWeight: T.value.fontWeight,
    letterSpacing: T.value.letterSpacing,
    color
  }),

  // Title text style
  titleStyle: (color: string): React.CSSProperties => ({
    fontSize: T.title.fontSize,
    fontWeight: T.title.fontWeight,
    letterSpacing: T.title.letterSpacing,
    textTransform: TransformKeys.uppercase as 'uppercase',
    color
  }),

  // Small text style
  smallStyle: (color: string): React.CSSProperties => ({
    fontSize: T.small.fontSize,
    fontWeight: T.small.fontWeight,
    letterSpacing: T.small.letterSpacing,
    color
  }),

  // Centered flex container
  centered: (): React.CSSProperties => ({
    display: F.flex,
    justifyContent: F.center,
    alignItems: F.center
  }),

  // Absolute fill
  absoluteFill: (): React.CSSProperties => ({
    position: P.absolute as 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  }),

  // Transition
  transition: (speed: 'fast' | 'normal' | 'slow' | 'cubic' = 'normal'): React.CSSProperties => ({
    transition: TransitionKeys[speed]
  })
};

export type LayoutAPIType = typeof LayoutAPI;
