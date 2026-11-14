import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { hexToRgba } from '../../../color.ts';
import { LAYOUT, TIMING } from '../../DesignSystem.ts';

export type TooltipDescriptions = Readonly<Record<string, string>>;

interface TooltipContextValue {
  setTooltip: (text: string | null) => void;
  currentTooltip: string | null;
  // Longer text a host supplies for a control's label.
  descriptions: TooltipDescriptions;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

export function useTooltip() {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error('useTooltip must be used within a TooltipProvider');
  }
  return context;
}

// Safe version that returns a no-op if outside provider
export function useTooltipSafe() {
  const context = useContext(TooltipContext);
  if (!context) {
    return { setTooltip: (_: string | null) => {}, currentTooltip: null, descriptions: {} as TooltipDescriptions };
  }
  return context;
}

/** The key a host's descriptions file a label under: its words in camelCase, so "COYOTE TIME" and "Coyote time" are
 *  `coyoteTime`. A word is a run of letters and digits; anything else between them only separates. */
export const descriptionKey = (label: string) => (label.toLowerCase().match(/[a-z0-9]+/g) ?? [])
  .map((word, index) => index === 0 ? word : word[0].toUpperCase() + word.slice(1)).join('');

/** A control's tooltip: its own, else the host's own description of its label, else the one it generates from its
 *  value. */
export function controlTooltip(own: string | undefined, label: string | undefined, descriptions: TooltipDescriptions,
  generated: string): string {
  const key = label === undefined ? undefined : descriptionKey(label);
  return own || (key !== undefined && Object.hasOwn(descriptions, key) ? descriptions[key] : '') || generated;
}

// Helper to generate knob tooltip
export function generateKnobTooltip(label?: string, min?: number, max?: number, displayValue?: string): string {
  const name = label || 'Value';
  const range = min !== undefined && max !== undefined ? ` (${min} to ${max})` : '';
  const current = displayValue ? ` — Current: ${displayValue}` : '';
  return `${name}${range}${current}`;
}

// Helper to generate range knob tooltip
export function generateRangeKnobTooltip(label?: string, minVal?: number, maxVal?: number, min?: number, max?: number): string {
  const name = label || 'Range';
  const bounds = min !== undefined && max !== undefined ? ` (bounds: ${min} to ${max})` : '';
  const current = minVal !== undefined && maxVal !== undefined ? ` — Current: ${minVal.toFixed(1)} to ${maxVal.toFixed(1)}` : '';
  return `${name}${bounds}${current}`;
}

// Helper to generate boolean tooltip
export function generateBooleanTooltip(label?: string, value?: boolean): string {
  const name = label || 'Toggle';
  const state = value !== undefined ? ` — ${value ? 'Enabled' : 'Disabled'}` : '';
  return `${name}${state}`;
}

// Helper to generate picker/enum tooltip
export function generateEnumTooltip(label?: string, value?: string): string {
  const name = label || 'Selection';
  const current = value ? ` — ${value}` : '';
  return `${name}${current}`;
}

interface TooltipProviderProps {
  children: ReactNode;
  descriptions?: TooltipDescriptions;
}

export function TooltipProvider({ children, descriptions = {} }: TooltipProviderProps) {
  const [currentTooltip, setCurrentTooltip] = useState<string | null>(null);

  const setTooltip = useCallback((text: string | null) => {
    setCurrentTooltip(text);
  }, []);

  return (
    <TooltipContext.Provider value={{ setTooltip, currentTooltip, descriptions }}>
      {children}
    </TooltipContext.Provider>
  );
}

// Display component for the tooltip - place at bottom of module
export function TooltipDisplay() {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  const { currentTooltip } = useTooltip();

  return (
    <div style={{
      height: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingLeft: LAYOUT.itemGap,
      paddingRight: LAYOUT.itemGap,
      overflow: 'hidden'
    }}>
      <span style={{
        fontSize: '10px',
        color: hexToRgba(style.textColor, 0.6),
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: currentTooltip ? 1 : 0,
        transform: currentTooltip ? 'translateY(0)' : 'translateY(4px)',
        transition: `opacity ${TIMING.normal}ms ease-out, transform ${TIMING.normal}ms ease-out`
      }}>
        {currentTooltip || ''}
      </span>
    </div>
  );
}

// HOC wrapper for any element that needs a tooltip
interface WithTooltipProps {
  tooltip: string;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export function WithTooltip({ tooltip, children, style, className }: WithTooltipProps) {
  const { setTooltip } = useTooltip();

  return (
    <div
      onMouseEnter={() => setTooltip(tooltip)}
      onMouseLeave={() => setTooltip(null)}
      onFocus={() => setTooltip(tooltip)}
      onBlur={() => setTooltip(null)}
      style={style}
      className={className}
    >
      {children}
    </div>
  );
}
