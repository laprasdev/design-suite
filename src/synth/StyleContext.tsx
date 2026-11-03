import React, { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { CasingOption } from './design/SharedTokens.ts';
import { DEFAULT_SKIN, SKIN_FILES } from '../skins.ts';
import type { HciDataComposable } from './design/Composable.ts';
import { skinStyle } from './skinStyle.ts';

export { skinStyle };

export interface StyleTheme {
  containers?: Record<string, HciDataComposable>;
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

interface StyleContextType {
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

const StyleContext = createContext<StyleContextType | null>(null);

const STYLE_STORAGE_KEY = 'synth-style-settings';

interface PersistedStyleState {
  styleName: string;
  primaryColorOverride: string | null;
  secondaryColorOverride: string | null;
  backgroundOverride: string | null;
  advancedSettings: AdvancedSettings;
}

const DEFAULT_ADVANCED_SETTINGS: AdvancedSettings = {
  buttonCasing: 'ALL CAPITALS',
  buttonWidth: 'CONSISTENT',
  enumStyle: 'SHARED BACK',
  enumGlowMode: 'GLOW',
  graphGridX: 'on',
  graphGridXDistance: '1/4',
  graphGridY: 'on',
  graphGridYDistance: '1/4',
  graphGridOpacity: 0.5,
  numberPickerContrast: 'HIGH',
  moduleDisplayMode: 'CUTOUT'
};

function loadPersistedState(): Partial<PersistedStyleState> {
  try {
    const saved = localStorage.getItem(STYLE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load style settings:', e);
  }
  return {};
}

export function StyleProvider({ children, persist = true }: { children: ReactNode; persist?: boolean }) {
  const persisted = loadPersistedState();

  const [styleName, setStyleNameState] = useState(persisted.styleName && SKIN_FILES[persisted.styleName] ? persisted.styleName : DEFAULT_SKIN);
  const [primaryColorOverride, setPrimaryColorOverrideState] = useState<string | null>(persisted.primaryColorOverride ?? null);
  const [secondaryColorOverride, setSecondaryColorOverrideState] = useState<string | null>(persisted.secondaryColorOverride ?? null);
  const [backgroundOverride, setBackgroundOverrideState] = useState<string | null>(persisted.backgroundOverride ?? null);
  const [advancedSettings, setAdvancedSettingsState] = useState<AdvancedSettings>({
    ...DEFAULT_ADVANCED_SETTINGS,
    ...persisted.advancedSettings
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    if (!persist) return;
    try {
      const toSave: PersistedStyleState = {
        styleName,
        primaryColorOverride,
        secondaryColorOverride,
        backgroundOverride,
        advancedSettings
      };
      localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save style settings:', e);
    }
  }, [persist, styleName, primaryColorOverride, secondaryColorOverride, backgroundOverride, advancedSettings]);

  // Wrapper functions to handle state updates
  const setStyleName = (name: string) => setStyleNameState(name);
  const setPrimaryColorOverride = (color: string | null) => setPrimaryColorOverrideState(color);
  const setSecondaryColorOverride = (color: string | null) => setSecondaryColorOverrideState(color);
  const setBackgroundOverride = (color: string | null) => setBackgroundOverrideState(color);
  const setAdvancedSettings = (settings: AdvancedSettings) => setAdvancedSettingsState(settings);

  const currentStyle = useMemo(() => skinStyle(styleName), [styleName]);

  const revertToStyle = () => {
    setPrimaryColorOverride(null);
    setSecondaryColorOverride(null);
    setBackgroundOverride(null);
  };

  const getEffectiveStyle = (): StyleTheme => {
    const style = { ...currentStyle };
    if (primaryColorOverride) {
      style.primaryColor = primaryColorOverride;
      // Update glow color to match
      const rgb = hexToRgb(primaryColorOverride);
      if (rgb) {
        style.glowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`;
        style.inactiveColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
      }
    }
    if (secondaryColorOverride) {
      style.secondaryColor = secondaryColorOverride;
    }
    if (backgroundOverride) {
      style.backgroundColor = backgroundOverride;
      style.backgroundGradientStart = backgroundOverride;
      style.backgroundGradientEnd = backgroundOverride;
    }
    if (advancedSettings.moduleDisplayMode === 'FLAT') {
      style.cutoutBackground = style.backgroundColor;
      style.cutoutBorder = style.borderColor;
      style.isFlat = true;
    } else {
      style.isFlat = false;
    }
    const accentMode = advancedSettings.accentColorMode ?? 'styled';
    if (accentMode === 'primary') style.accentColor = style.primaryColor;
    else if (accentMode === 'secondary') style.accentColor = style.secondaryColor;
    else if (accentMode === 'custom' && advancedSettings.accentColorOverride) style.accentColor = advancedSettings.accentColorOverride;
    return style;
  };

  useEffect(() => {
    const effectiveStyle = getEffectiveStyle();
    document.documentElement.style.setProperty('--theme-primary', effectiveStyle.primaryColor);

    let styleEl = document.getElementById('dynamic-scrollbar-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-scrollbar-style';
      document.head.appendChild(styleEl);
    }

    const rgb = hexToRgb(effectiveStyle.primaryColor);
    const scrollThumb = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)` : 'rgba(51, 169, 168, 0.4)';
    const scrollThumbHover = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)` : 'rgba(51, 169, 168, 0.7)';
    const scrollTrack = 'rgba(10, 14, 16, 0.5)';

    styleEl.textContent = `
      html ::-webkit-scrollbar, body ::-webkit-scrollbar, * ::-webkit-scrollbar {
        width: 3px !important; height: 3px !important;
      }
      html ::-webkit-scrollbar-track, body ::-webkit-scrollbar-track, * ::-webkit-scrollbar-track {
        background: ${scrollTrack} !important;
      }
      html ::-webkit-scrollbar-thumb, body ::-webkit-scrollbar-thumb, * ::-webkit-scrollbar-thumb {
        background: ${scrollThumb} !important; border-radius: 0 !important;
      }
      html ::-webkit-scrollbar-thumb:hover, body ::-webkit-scrollbar-thumb:hover, * ::-webkit-scrollbar-thumb:hover {
        background: ${scrollThumbHover} !important;
      }
      html ::-webkit-scrollbar-corner, body ::-webkit-scrollbar-corner, * ::-webkit-scrollbar-corner {
        background: transparent !important;
      }
      html, body, * {
        scrollbar-width: thin !important;
        scrollbar-color: ${scrollThumb} ${scrollTrack} !important;
      }
    `;
  }, [styleName, primaryColorOverride, secondaryColorOverride, backgroundOverride, advancedSettings]);

  return (
    <StyleContext.Provider
      value={{
        currentStyle,
        styleName,
        setStyleName,
        primaryColorOverride,
        setPrimaryColorOverride,
        secondaryColorOverride,
        setSecondaryColorOverride,
        backgroundOverride,
        setBackgroundOverride,
        advancedSettings,
        setAdvancedSettings,
        revertToStyle,
        getEffectiveStyle
      }}
    >
      {children}
    </StyleContext.Provider>
  );
}

export function useStyle() {
  const context = useContext(StyleContext);
  if (!context) {
    throw new Error('useStyle must be used within StyleProvider');
  }
  return context;
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
