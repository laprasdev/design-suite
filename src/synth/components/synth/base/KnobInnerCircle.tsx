// =====================================================
// KNOB INNER CIRCLE - Shared component for all knob types
// Used by: Knob, DualTickRangeKnob, any future knob variants
// =====================================================

import React from 'react';
import { getKnobGradient } from '../../../../color.ts';
import type { StyleTheme } from '../../../StyleTypes.ts';
import { TransitionKeys, LayoutDimensions } from '../../../design/index.ts';
import { KnobSize } from '../../../design/constants/KnobConfig.ts';

export interface KnobInnerCircleProps {
  /** Inner circle size in pixels */
  appearance?: string;
  innerSize: number;
  /** Padding from knob edge */
  innerPadding: number;
  /** Knob size tier for shadow calculation */
  size: number;
  /** Color scheme from getColorScheme() */
  scheme: {
    main: string;
    inner: string;
    glow: string;
  };
  /** Style object from getEffectiveStyle() */
  style: Pick<StyleTheme, 'knobGradient' | 'components'>;
  /** Whether knob is hovered or being dragged */
  isActive?: boolean;
  /** Hover glow radius - defaults to LayoutDimensions.knob.hoverGlow */
  hoverGlow?: number;
}

/**
 * Renders the inner circle of a knob with size-aware shadows and hover effects.
 * Ensures consistent appearance across all knob types.
 */
export function KnobInnerCircle({
  innerSize, appearance,
  innerPadding,
  size,
  scheme,
  style,
  isActive = false,
  hoverGlow = LayoutDimensions.knob.hoverGlow
}: KnobInnerCircleProps) {
  // Build shadow based on size tier
  const getBoxShadow = (): string => {
    const activeGlow = isActive ? `, 0 0 ${hoverGlow}px ${scheme.glow}` : '';

    if (size <= KnobSize.MINI) {
      return `0 1px 3px rgba(0,0,0,0.5), inset 0 1px 2px ${scheme.inner}${activeGlow}`;
    }

    if (size <= KnobSize.STANDARD) {
      return `0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 2px ${scheme.inner}, inset 0 -1px 2px rgba(0, 0, 0, 0.6)${activeGlow}`;
    }

    // LARGE and above get the full treatment
    return `0 3px 6px rgba(0, 0, 0, 0.5), inset 0 2px 4px ${scheme.inner}, inset 0 -2px 4px rgba(0, 0, 0, 0.7)${activeGlow}`;
  };

  const face = appearance ? undefined : style.components?.['knob.inner'];
  const background = face?.palette?.cutoutBackground ?? face?.palette?.background;
  const edge = face?.border?.width ?? face?.edge?.width ?? 1;
  const border = face?.palette?.border ?? face?.palette?.cutoutBorder ?? scheme.inner;
  return (
    <div data-knob-face
      style={{
        position: 'absolute',
        width: innerSize,
        height: innerSize,
        top: innerPadding,
        left: innerPadding,
        borderRadius: '50%',
        background: background ?? getKnobGradient(style),
        boxShadow: face?.shadow?.opacity === 0 ? 'none' : getBoxShadow(),
        border: `${edge}px solid ${border}`,
        transition: TransitionKeys.normal
      }}
    />
  );
}
