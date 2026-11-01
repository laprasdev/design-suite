// =====================================================
// CONSTANTS INDEX - Single import point for all constants
// =====================================================

export { ContainerType, isContainerType } from './ContainerTypes.ts';
export type { ContainerTypeValue } from './ContainerTypes.ts';

export { DisplayMode, isDisplayMode, isFlat, isCutout } from './DisplayModes.ts';
export type { DisplayModeValue } from './DisplayModes.ts';

export { createBorder, createThickBorder, noBorder } from './BorderStyles.ts';


// Knob configuration system
export {
  KnobSize,
  KnobStroke,
  KnobValueType,
  KnobLayout,
  KnobLabelStyle,
  KnobFeature,
  KnobPreset,
  hasFeature,
  createKnobConfig,
  getKnobDimensions,
  getKnobSensitivity
} from './KnobConfig.ts';
export type {
  KnobSizeValue,
  KnobStrokeValue,
  KnobValueTypeValue,
  KnobLayoutValue,
  KnobLabelStyleValue,
  KnobFeatureValue,
  KnobConfig,
  KnobPresetKey
} from './KnobConfig.ts';
