import {hexToRgba, hexToFloatRgba} from '../color.ts';
import { useDocumentPalette } from '../react/useDocumentPalette.ts';
import type { ComponentSkin } from '../skinAssignments.ts';
import { skinForm } from '../skinForms.ts';
import { ContainerForm, SkinKind } from '../skinKinds.ts';
import React, { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { DEFAULT_SKIN, SKIN_FILES } from '../skins.ts';
import { skinStyle } from './skinStyle.ts';

export { skinStyle };
export type { StyleTheme, AdvancedSettings, AccentColorMode, CasingOption } from './StyleTypes.ts';
import type { StyleTheme, AdvancedSettings, StyleContextType } from './StyleTypes.ts';

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

export function StyleProvider({ children, persist = true, initialStyleName, palette, skin, documentStyles = true }: {
  children: ReactNode; persist?: boolean; initialStyleName?: string; palette?: string;
  skin?: ComponentSkin; documentStyles?: boolean;
}) {
  if (initialStyleName && !SKIN_FILES[initialStyleName]) throw new Error(`Unknown initial skin: ${initialStyleName}`);
  const [persisted] = useState<Partial<PersistedStyleState>>(() => palette ? {} : initialStyleName
    ? {styleName: initialStyleName} : loadPersistedState());

  const [savedStyleName, setStyleNameState] = useState(persisted.styleName && SKIN_FILES[persisted.styleName] ? persisted.styleName : DEFAULT_SKIN);
  const styleName = palette ?? savedStyleName;
  if (!SKIN_FILES[styleName]) throw new Error(`Unknown palette: ${styleName}`);
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

  const currentStyle = useMemo(() => skinStyle(styleName, !!skin), [styleName, !!skin]);

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
      const rgb = hexToFloatRgba(primaryColorOverride);
      if (rgb) {
        style.glowColor = hexToRgba(primaryColorOverride, 0.6);
        style.inactiveColor = hexToRgba(primaryColorOverride, 0.2);
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
    const surface = skinForm(skin, SkinKind.CONTAINER);
    const flat = surface === ContainerForm.FLAT;
    if (flat || (!surface && advancedSettings.moduleDisplayMode === 'FLAT')) {
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

  useDocumentPalette(getEffectiveStyle().primaryColor, documentStyles);

  return (
    <StyleContext.Provider
      value={{
        currentStyle, skin,
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

