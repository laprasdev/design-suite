import React, { useState, useRef, useCallback } from 'react';
import { useStyle } from '../../../StyleContext.tsx';
import { getColorScheme, resolveColorType, hexToRgba, type AnyColor, getInsetShadow } from '../../../../color.ts';
import { D, T, O, F, Borders, TransitionKeys, LayoutDimensions } from '../../../design/index.ts';
import {
  type KnobConfig,
  KnobPreset,
  type KnobPresetKey,
  KnobSize,
  KnobLayout,
  KnobLabelStyle,
  getKnobDimensions,
  getKnobSensitivity
} from '../../../design/constants/KnobConfig.ts';
import { useTooltipSafe } from '../TooltipContext.tsx';
import { KnobInnerCircle } from '../base/index.ts';
import { RangeLimitLabels } from './RangeLimitLabels.tsx';

// =====================================================
// DUAL TICK RANGE KNOB - Config-based architecture
// Two draggable ticks for min/max range selection
// =====================================================

// Use the EXACT same coordinate system as HorseshoeRing from Knob.tsx
const START_ANGLE = 225;
const END_ANGLE = 495;
const ANGLE_RANGE = END_ANGLE - START_ANGLE; // 270°

export interface DualTickRangeKnobProps {
  minValue: number;
  maxValue: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  displayFormat?: (min: number, max: number) => string;
  color?: AnyColor;
  disabled?: boolean;
  minDisabled?: boolean;
  maxDisabled?: boolean;
  minOpacity?: number;
  maxOpacity?: number;
  minimumGapFraction?: number;
  showToggle?: boolean;
  /** The range's own ends, in tiny type at the ring's ends. A page module leaves them off, as its values say them. */
  showLimits?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (v: boolean) => void;
  tooltip?: string;
  // Config-based approach
  preset?: KnobPresetKey;
  config?: KnobConfig;
  size?: number;
  layout?: typeof KnobLayout[keyof typeof KnobLayout];
}

export function DualTickRangeKnob({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  min = 0,
  max = 1,
  label,
  displayFormat = (minV, maxV) => `${Math.round(minV * 100)}-${Math.round(maxV * 100)}`,
  color = 'primary',
  disabled = false,
  minDisabled = false,
  maxDisabled = false,
  minOpacity = 1,
  maxOpacity = 1,
  minimumGapFraction = 0.02,
  showToggle = false,
  showLimits = true,
  toggleValue = true,
  onToggleChange,
  tooltip,
  preset = 'range',
  config: configProp,
  size: sizeOverride,
  layout: layoutOverride
}: DualTickRangeKnobProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();
  const { setTooltip, descriptions } = useTooltipSafe();

  // Resolve config: explicit config > preset with overrides
  const baseConfig = configProp ?? KnobPreset[preset];
  const config: KnobConfig = {
    ...baseConfig,
    size: sizeOverride ?? baseConfig.size,
    layout: layoutOverride ?? baseConfig.layout
  };

  // Get derived dimensions from config
  const dims = getKnobDimensions(config);
  const scheme = getColorScheme(resolveColorType(color), style);

  const [activeTick, setActiveTick] = useState<'min' | 'max' | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);

  const normalizedMin = (minValue - min) / (max - min);
  const normalizedMax = (maxValue - min) / (max - min);
  const isDisabled = disabled || (showToggle && !toggleValue);

  // Layout configuration
  const isHorizontal = config.layout === KnobLayout.HORIZONTAL;
  const isKnobOnly = config.layout === KnobLayout.KNOB_ONLY;
  const useCutoutLabel = config.labelStyle === KnobLabelStyle.CUTOUT;

  // Generate auto-tooltip if none provided
  const getTooltipText = useCallback(() => {
    if (tooltip) return tooltip;
    const key = label?.toLowerCase().replace(/\s+/g, '');
    if (key && descriptions?.[key]) return descriptions[key];
    const name = label || 'Range';
    const displayStr = displayFormat(minValue, maxValue);
    return `${name}: ${displayStr} (bounds: ${min} to ${max})`;
  }, [tooltip, label, displayFormat, minValue, maxValue, min, max, descriptions]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setTooltip(getTooltipText());
  }, [setTooltip, getTooltipText]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTooltip(null);
  }, [setTooltip]);

  // Convert normalized value (0-1) to angle using HorseshoeRing's system
  const valueToAngle = (normalized: number): number => {
    return START_ANGLE + (ANGLE_RANGE * normalized);
  };

  // Get angle from mouse position relative to knob center
  const getAngleFromEvent = useCallback((e: MouseEvent | React.MouseEvent): number => {
    if (!knobRef.current) return START_ANGLE;
    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;

    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    angle = angle + 90;
    if (angle < 0) angle += 360;
    if (angle < START_ANGLE - 45) {
      angle += 360;
    }
    return angle;
  }, []);

  // Determine which tick is closer to click position - NO threshold, always pick closer
  const getCloserTick = useCallback((e: React.MouseEvent): 'min' | 'max' => {
    if (minDisabled !== maxDisabled) return minDisabled ? 'max' : 'min';
    const clickAngle = getAngleFromEvent(e);
    const minAngle = valueToAngle(normalizedMin);
    const maxAngle = valueToAngle(normalizedMax);

    const distToMin = Math.abs(clickAngle - minAngle);
    const distToMax = Math.abs(clickAngle - maxAngle);
    if (Math.abs(distToMin - distToMax) < 0.001)
      return e.clientX < knobRef.current!.getBoundingClientRect().left + dims.size / 2 ? 'min' : 'max';
    return distToMin < distToMax ? 'min' : 'max';
  }, [normalizedMin, normalizedMax, getAngleFromEvent, minDisabled, maxDisabled, dims.size]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isDisabled) return;
    e.preventDefault();
    e.stopPropagation();

    const tick = getCloserTick(e);
    if (tick === 'min' ? minDisabled : maxDisabled) return;
    setActiveTick(tick);
    dragStartY.current = e.clientY;
    dragStartValue.current = tick === 'min' ? minValue : maxValue;
  }, [isDisabled, minDisabled, maxDisabled, getCloserTick, minValue, maxValue]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeTick) return;
    if (e.buttons === 0) { setActiveTick(null); return; }

    const deltaY = dragStartY.current - e.clientY;
    // Use much lower sensitivity - 0.002 per pixel for smooth control
    const baseSensitivity = 0.002;
    const range = max - min;
    const sensitivity = baseSensitivity * range;
    let newValue = dragStartValue.current + deltaY * sensitivity;
    newValue = Math.max(min, Math.min(max, newValue));

    if (activeTick === 'min') {
      onMinChange(Math.min(newValue, maxValue - range * minimumGapFraction));
    } else {
      onMaxChange(Math.max(newValue, minValue + range * minimumGapFraction));
    }
  }, [activeTick, min, max, minValue, maxValue, minimumGapFraction, onMinChange, onMaxChange]);

  const handleMouseUp = useCallback(() => setActiveTick(null), []);

  const cancelDrag = useCallback(() => {
    if (!activeTick) return;
    if (activeTick === 'min') onMinChange(dragStartValue.current);
    else onMaxChange(dragStartValue.current);
    setActiveTick(null);
  }, [activeTick, onMinChange, onMaxChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') cancelDrag();
    else if (e.key === 'Enter' || e.key === 'Tab') setActiveTick(null);
  }, [cancelDrag]);

  React.useEffect(() => {
    if (!activeTick) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleMouseUp);
    };
  }, [activeTick, handleMouseMove, handleMouseUp, handleKeyDown]);

  // Render the horseshoe ring - simplified approach matching HorseshoeRing from Knob.tsx
  const renderRangeArc = () => {
    const radius = (dims.size - dims.stroke) / 2 - 2;
    const center = dims.size / 2;
    const inactiveStroke = hexToRgba(style.knobGradient.at(-1)!, O.high);

    // Background arc: full horseshoe from START_ANGLE to END_ANGLE
    const startRad = (START_ANGLE - 90) * (Math.PI / 180);
    const endRad = (END_ANGLE - 90) * (Math.PI / 180);
    const bgX1 = center + radius * Math.cos(startRad);
    const bgY1 = center + radius * Math.sin(startRad);
    const bgX2 = center + radius * Math.cos(endRad);
    const bgY2 = center + radius * Math.sin(endRad);

    // Active arc: from min position to max position
    const minAngle = valueToAngle(normalizedMin);
    const maxAngle = valueToAngle(normalizedMax);
    const minRad = (minAngle - 90) * (Math.PI / 180);
    const maxRad = (maxAngle - 90) * (Math.PI / 180);
    const activeX1 = center + radius * Math.cos(minRad);
    const activeY1 = center + radius * Math.sin(minRad);
    const activeX2 = center + radius * Math.cos(maxRad);
    const activeY2 = center + radius * Math.sin(maxRad);

    // Large arc flag: 1 if arc spans > 180 degrees
    const arcSpan = maxAngle - minAngle;
    const largeArc = arcSpan > 180 ? 1 : 0;

    // Min/max label positions (just outside horseshoe ends)
    const labelOffset = 3;
    const minLabelX = bgX1 - labelOffset;
    const minLabelY = bgY1 + 2;
    const maxLabelX = bgX2 + labelOffset;
    const maxLabelY = bgY2 + 2;

    return (
      <svg width={dims.size} height={dims.size} style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
        {/* Background: full horseshoe arc */}
        <path
          d={`M ${bgX1} ${bgY1} A ${radius} ${radius} 0 1 1 ${bgX2} ${bgY2}`}
          fill="none"
          stroke={inactiveStroke}
          strokeWidth={dims.stroke}
          strokeLinecap="round"
        />
        {/* Active: range from min to max - only render if valid range */}
        {normalizedMax > normalizedMin && (
          <path
            d={`M ${activeX1} ${activeY1} A ${radius} ${radius} 0 ${largeArc} 1 ${activeX2} ${activeY2}`}
            fill="none"
            stroke={scheme.main}
            opacity={Math.max(minOpacity, maxOpacity)}
            strokeWidth={dims.stroke}
            strokeLinecap="round"
            style={{
              filter: (activeTick || isHovered)
                ? `drop-shadow(0 0 ${dims.glowRadius}px ${scheme.glow})`
                : `drop-shadow(0 0 ${LayoutDimensions.knob.glowSmall}px ${scheme.glow})`,
              transition: TransitionKeys.normal
            }}
          />
        )}
        {showLimits && <RangeLimitLabels min={min} max={max} color={style.textColor}
          minAt={{ x: minLabelX, y: minLabelY }} maxAt={{ x: maxLabelX, y: maxLabelY }} />}
      </svg>
    );
  };

  // Render a draggable tick indicator
  const renderTick = (normalized: number, type: 'min' | 'max') => {
    const angle = valueToAngle(normalized);
    const isActive = activeTick === type;

    const rad = (angle - 90) * (Math.PI / 180);
    const arcR = (dims.size - dims.stroke) / 2 - 2;
    const tickHalf = 5;
    const innerR = arcR - tickHalf;
    const outerR = arcR + tickHalf;
    const center = dims.size / 2;

    const innerX = center + innerR * Math.cos(rad);
    const innerY = center + innerR * Math.sin(rad);
    const outerX = center + outerR * Math.cos(rad);
    const outerY = center + outerR * Math.sin(rad);
    const dotX = center + arcR * Math.cos(rad);
    const dotY = center + arcR * Math.sin(rad);

    return (
      <g opacity={type === 'min' ? minOpacity : maxOpacity} style={{ cursor: isDisabled || (type === 'min' ? minDisabled : maxDisabled) ? 'not-allowed' : 'pointer' }}>
        <circle cx={dotX} cy={dotY} r={12} fill="transparent" />
        <line
          x1={innerX} y1={innerY} x2={outerX} y2={outerY}
          stroke={type === 'min' ? hexToRgba(scheme.main, 0.8) : scheme.main}
          strokeWidth={isActive ? 4 : 3}
          strokeLinecap="round"
          style={{
            filter: isActive
              ? `drop-shadow(0 0 ${LayoutDimensions.knob.tickGlowActive}px ${scheme.glow})`
              : `drop-shadow(0 0 ${LayoutDimensions.knob.tickGlowInactive}px ${scheme.glow})`,
            transition: 'stroke-width 0.1s'
          }}
        />
        <circle
          cx={dotX} cy={dotY}
          r={isActive ? 4 : 3}
          fill={scheme.main}
          style={{
            filter: `drop-shadow(0 0 ${LayoutDimensions.knob.glowSmall}px ${scheme.glow})`,
            transition: 'r 0.1s'
          }}
        />
      </g>
    );
  };

  // Knob element
  const knobElement = (
    <div
      data-control-anchor="radial"
      ref={knobRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'relative',
        width: dims.size,
        height: dims.size,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        flexShrink: 0
      }}
    >
      {renderRangeArc()}
      <KnobInnerCircle
        innerSize={dims.innerSize}
        innerPadding={dims.innerPadding}
        size={config.size}
        scheme={scheme}
        style={style}
        isActive={activeTick !== null || isHovered}
        hoverGlow={dims.hoverGlow}
      />
      <svg
        width={dims.size}
        height={dims.size}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      >
        <g style={{ pointerEvents: 'auto' }}>
          {renderTick(normalizedMin, 'min')}
          {renderTick(normalizedMax, 'max')}
        </g>
      </svg>
    </div>
  );

  // Label/value element
  const labelValueElement = !isKnobOnly && (
    <div style={{
      display: F.flex,
      flexDirection: isHorizontal ? F.row as 'row' : F.column as 'column',
      alignItems: F.center,
      justifyContent: F.center,
      gap: isHorizontal ? '6px' : '4px'
    }}>
      <div style={{
        fontSize: T.small.fontSize,
        color: scheme.main,
        fontWeight: T.small.fontWeight,
        textAlign: 'center',
        opacity: O.high
      }}>
        {displayFormat(minValue, maxValue)}
      </div>
      {label && (
        useCutoutLabel ? (
          <div style={{
            fontSize: config.size <= KnobSize.MINI ? T.small.fontSize : T.label.fontSize,
            padding: `${D.spacing.microGap}px ${D.spacing.tightGap * 1.5}px`,
            borderRadius: D.radius.tiny,
            textTransform: 'uppercase',
            letterSpacing: T.label.letterSpacing,
            color: scheme.main,
            background: style.cutoutBackground,
            border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
            boxShadow: getInsetShadow('shallow'),
            textAlign: 'center',
            fontWeight: T.label.fontWeight
          }}>
            {label}
          </div>
        ) : (
          <div style={{
            fontSize: T.small.fontSize,
            textTransform: 'uppercase',
            letterSpacing: T.label.letterSpacing,
            color: scheme.main,
            fontWeight: T.label.fontWeight,
            textAlign: 'center',
            opacity: O.medium
          }}>
            {label}
          </div>
        )
      )}
    </div>
  );

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: F.flex,
        flexDirection: isHorizontal ? F.row as 'row' : F.column as 'column',
        alignItems: F.center,
        gap: isHorizontal ? '6px' : '4px',
        opacity: isDisabled ? 0.4 : 1,
        transition: TransitionKeys.fast,
        position: 'relative'
      }}
    >
      {showToggle && (
        <button
          onClick={() => onToggleChange?.(!toggleValue)}
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 12,
            height: 12,
            borderRadius: '3px',
            background: toggleValue ? hexToRgba(scheme.main, 0.3) : 'transparent',
            border: `1px solid ${toggleValue ? scheme.main : style.cutoutBorder}`,
            cursor: 'pointer',
            padding: 0,
            boxShadow: toggleValue ? `0 0 6px ${hexToRgba(scheme.main, 0.6)}` : 'none',
            zIndex: 10
          }}
        />
      )}

      {knobElement}
      {labelValueElement}
    </div>
  );
}
