// =====================================================
// BORDER STYLES - Eliminates '1px solid' magic strings
// =====================================================

import { Borders } from '../../../tokens.ts';

// Standard border creator - replaces all `1px solid ${color}` patterns
export function createBorder(color: string): string {
  return `${Borders.standard.width}px ${Borders.standard.style} ${color}`;
}

// Thick border creator
export function createThickBorder(color: string): string {
  return `${Borders.thick.width}px ${Borders.thick.style} ${color}`;
}

// No border constant
export const noBorder = 'none';
