// =====================================================
// DISPLAY MODES - Eliminates magic strings for CUTOUT/FLAT toggle
// =====================================================

export const DisplayMode = {
  CUTOUT: 'CUTOUT',
  FLAT: 'FLAT'
} as const;

export type DisplayModeValue = typeof DisplayMode[keyof typeof DisplayMode];

// Type guard for runtime validation
export function isDisplayMode(value: string): value is DisplayModeValue {
  return Object.values(DisplayMode).includes(value as DisplayModeValue);
}

// Helper to check if flat mode
export function isFlat(mode: DisplayModeValue): boolean {
  return mode === DisplayMode.FLAT;
}

// Helper to check if cutout mode
export function isCutout(mode: DisplayModeValue): boolean {
  return mode === DisplayMode.CUTOUT;
}
