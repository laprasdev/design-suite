// =====================================================
// CONTAINER TYPES - Eliminates magic strings for container variants
// =====================================================

export const ContainerType = {
  MODULE: 'module',
  CUTOUT: 'cutout',
  BUTTON: 'button',
  NODE: 'node'
} as const;

export type ContainerTypeValue = typeof ContainerType[keyof typeof ContainerType];

// Type guard for runtime validation
export function isContainerType(value: string): value is ContainerTypeValue {
  return Object.values(ContainerType).includes(value as ContainerTypeValue);
}
