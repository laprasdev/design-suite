// =====================================================
// DESIGN SYSTEM INDEX
// Import everything from here: import { LayoutAPI, D, DC, S, T, O, F } from './design';
// =====================================================

export * from './LayoutAPI.ts';
export { PHI, PHI_INVERSE, PHI_SQUARED, Relativity, LayoutDimensions } from '../../layout.ts';
export { CompactDimensions, SCALE, sc, setScale } from '../../layout.ts';

// Shorthand aliases
import { LayoutDimensions } from '../../layout.ts';
import { CompactDimensions } from '../../layout.ts';
import { Typography } from '../../tokens.ts';
export const SIZES = LayoutDimensions.sizes;
export const DC = CompactDimensions;

// Shared synth label style (fontSize:8, fontWeight:600, letterSpacing:'0.05em')
import type React from 'react';
export const SYNTH_LABEL: React.CSSProperties = {
  fontSize: Typography.small.fontSize,
  fontWeight: 600,
  letterSpacing: '0.05em',
};

export const STRIP_LABEL: React.CSSProperties = {
  ...SYNTH_LABEL, cursor: 'pointer', userSelect: 'none',
};

export const TOOLBAR_LABEL: React.CSSProperties = {
  fontSize: Typography.value.fontSize, fontWeight: 700, lineHeight: 1, letterSpacing: Typography.value.letterSpacing,
  cursor: 'pointer', userSelect: 'none',
};

// Constants - eliminates magic strings
export * from './constants/index.ts';

// Shared tokens - cross-cutting utilities & types
export { applyCasing, camelToSpaced } from './SharedTokens.ts';
export type { CasingOption } from './SharedTokens.ts';
