import type { ComponentSkin } from '../skinAssignments.ts';
import type { CasingOption } from './design/SharedTokens.ts';
import type { HciDataComposable } from './design/Composable.ts';

export interface StyleTheme {
  containers?: Record<string, HciDataComposable>;
  components?: Record<string, HciDataComposable>;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  accentColor: string;
  backgroundColor: string;
  backgroundGradientStart: string;
  backgroundGradientEnd: string;
  textColor: string;
  borderColor: string;
  glowColor: string;
  inactiveColor: string;
  cutoutBackground: string;
  cutoutBorder: string;
  isFlat: boolean;
  shadowStyle: string;
  knobGradient: string[];
}

export type AccentColorMode = 'styled' | 'primary' | 'secondary' | 'custom';

// Advanced settings for "Into the Rabbit Hole"
export interface AdvancedSettings {
  buttonCasing: CasingOption;
  enumCasing?: CasingOption;
  titleCasing?: CasingOption;
  nodeTitleCasing?: CasingOption;
  nodeChoiceCasing?: CasingOption;
  buttonWidth: 'CONSISTENT' | 'FIX TO WIDTH';
  enumStyle: 'DISTINCT' | 'SHARED BACK';
  enumGlowMode: 'FILL' | 'GLOW'; // For SHARED BACK style
  graphGridX: 'on' | 'off';
  graphGridXDistance: '1/8' | '1/4' | '1/3' | '1/2';
  graphGridY: 'on' | 'off';
  graphGridYDistance: '1/8' | '1/4' | '1/3' | '1/2';
  graphGridOpacity: number; // 0-1
  numberPickerContrast: 'SUBTLE' | 'MEDIUM' | 'HIGH';
  moduleDisplayMode: 'CUTOUT' | 'FLAT';
  // X Axis opacity
  xAxisOpacityMultiplier?: 'none' | '2x' | '3x';
  xAxisOpacity?: number;
  // Slop pulse animation
  slopPulseDuration?: number;
  // Section label settings
  sectionLabelSize?: number;
  sectionSubtextRatio?: number;
  sectionArrowSize?: number;
  // Loading Hole settings
  loadingEnabled?: boolean;
  loadingDuration?: number; // seconds
  loadingText?: string;
  loadingIterations?: number; // sine fade iterations before fade out
  // Filming settings
  minimalMode?: boolean; // Hide bottom rows (pickers, booleans, universals, konami)
  autoHideSettings?: boolean; // Auto-hide settings button after delay
  autoHideDelay?: number; // seconds before hiding
  // Layout settings
  layoutMode?: 'hd' | 'square'; // 'hd' = 16:9, 'square' = 1:1 with konami
  // Sweep dot gap between cycles
  sweepGapMs?: number;
  // Strip title alignment
  stripTitleAlign?: 'left' | 'right';
  // Accent color
  accentColorMode?: AccentColorMode;
  accentColorOverride?: string;
}

export type { CasingOption };

export interface StyleContextType {
  skin?: ComponentSkin;
  currentStyle: StyleTheme;
  styleName: string;
  setStyleName: (name: string) => void;
  primaryColorOverride: string | null;
  setPrimaryColorOverride: (color: string | null) => void;
  secondaryColorOverride: string | null;
  setSecondaryColorOverride: (color: string | null) => void;
  backgroundOverride: string | null;
  setBackgroundOverride: (color: string | null) => void;
  advancedSettings: AdvancedSettings;
  setAdvancedSettings: (settings: AdvancedSettings) => void;
  revertToStyle: () => void;
  getEffectiveStyle: () => StyleTheme;
}

