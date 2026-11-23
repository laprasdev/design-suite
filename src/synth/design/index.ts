// =====================================================
// DESIGN SYSTEM INDEX
// Import everything from here: import { LayoutAPI, D, DC, S, T, O, F } from './design';
// =====================================================

export * from './LayoutAPI.ts';
export { PHI, PHI_INVERSE, PHI_SQUARED } from '../../goldenRatio.ts';
export { Relativity, LayoutDimensions } from '../../layout.ts';
export { CompactDimensions, SCALE, sc, setScale } from '../../layout.ts';

// Shorthand aliases
import { LayoutDimensions } from '../../layout.ts';
import { CompactDimensions } from '../../layout.ts';
import { Typography } from '../../tokens.ts';
export const SIZES = LayoutDimensions.sizes;
export const DC = CompactDimensions;

import type React from 'react';
export const STRIP_LABEL: React.CSSProperties = {
  ...Typography.label, cursor: 'pointer', userSelect: 'none',
};

export const TOOLBAR_LABEL: React.CSSProperties = {
  ...Typography.value, fontWeight: 700, lineHeight: 1,
  cursor: 'pointer', userSelect: 'none',
};

/** A module's or a section's title: the one heading, at a module's text size, apart from a name by weight and case. */
export const MODULE_TITLE: React.CSSProperties = { ...Typography.title, textTransform: 'uppercase' };

// Constants - eliminates magic strings
export * from './constants/index.ts';

// Shared tokens - cross-cutting utilities & types
export { applyCasing, camelToSpaced } from './SharedTokens.ts';
export type { CasingOption } from './SharedTokens.ts';
