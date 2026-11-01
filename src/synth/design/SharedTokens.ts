// =====================================================
// SHARED TOKENS — cross-cutting constants & utilities
// =====================================================

// --- Text Casing ---

export type CasingOption = 'ALL CAPITALS' | 'Word Case' | 'lower case';

export function applyCasing(text: string, casing: CasingOption): string {
  if (casing === 'lower case') return text.toLowerCase();
  if (casing === 'Word Case') {
    return text.split(' ').map(
      w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
  }
  return text.toUpperCase();
}

export const camelToSpaced = (s: string): string =>
  s.replace(/([a-z])([A-Z])/g, '$1 $2');
