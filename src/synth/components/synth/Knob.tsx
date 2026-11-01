import React, { useCallback, useState, useRef } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, getInsetShadow, resolveColorType, hexToRgba, type AnyColor } from '../../../color.ts';
import { D, F, O, TransitionKeys, Borders, T } from '../../design/index.ts';
import {
  type KnobConfig,
  KnobPreset,
  type KnobPresetKey,
  KnobSize,
  KnobLayout,
  KnobLabelStyle,
  KnobValueType,
  KnobFeature,
  hasFeature,
  getKnobDimensions,
  getKnobSensitivity
} from '../../design/constants/KnobConfig.ts';
import { useKnobDrag, KnobInnerCircle } from './base/index.ts';
import { useTooltipSafe } from './TooltipContext.tsx';
import { ModulationRings } from './ModulationRings.tsx';
import type { ModulationProps } from './modulation.ts';

// =====================================================
// UNIFIED KNOB COMPONENT - Config-based architecture
// =====================================================

export type KnobColor = AnyColor;

const RING_INSET = 2;

// =====================================================
// HORSESHOE RING - SVG arc for knob fill
// =====================================================
interface HorseshoeRingProps {
  percentage: number;
  color?: string;
  size?: number;
  strokeWidth?: number;
  startAngle?: number;
  endAngle?: number;
}

export function HorseshoeRing({
  percentage,
  color = '#4dd4e8',
  size = 60,
  strokeWidth = 3,
  startAngle = 225,
  endAngle = 495
}: HorseshoeRingProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();

  const center = size / 2;
  const radius = (size - strokeWidth) / 2 - RING_INSET;
  const startRad = (startAngle - 90) * (Math.PI / 180);
  const endRad = (endAngle - 90) * (Math.PI / 180);
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (totalAngle * percentage);
  const currentRad = (currentAngle - 90) * (Math.PI / 180);

  const x1 = center + radius * Math.cos(startRad);
  const y1 = center + radius * Math.sin(startRad);
  const x2 = center + radius * Math.cos(currentRad);
  const y2 = center + radius * Math.sin(currentRad);
  const largeArc = (currentAngle - startAngle) > 180 ? 1 : 0;
  const inactiveStroke = hexToRgba(style.knobGradient.at(-1)!, O.high);

  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <path
        d={`M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${center + radius * Math.cos(endRad)} ${center + radius * Math.sin(endRad)}`}
        fill="none"
        stroke={inactiveStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {percentage > 0 && (
        <path
          d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// =====================================================
// KNOB INDICATOR - Position marker
// =====================================================
interface KnobIndicatorProps {
  percentage: number;
  size?: number;
  startAngle?: number;
  endAngle?: number;
  color?: string;
  indicatorWidth?: number;
  indicatorHeight?: number;
}

export function KnobIndicator({
  percentage,
  size = 60,
  startAngle = 225,
  endAngle = 495,
  color = '#4dd4e8',
  indicatorWidth = 4,
  indicatorHeight = 8
}: KnobIndicatorProps) {
  const totalAngle = endAngle - startAngle;
  const currentAngle = startAngle + (totalAngle * percentage);

  return (
    <div
      style={{
        position: 'absolute',
        width: indicatorWidth,
        height: indicatorHeight,
        borderRadius: D.radius.tiny,
        background: color,
        boxShadow: `0 0 4px ${color}`,
        top: D.spacing.tightGap,
        left: '50%',
        marginLeft: -indicatorWidth / 2,
        transformOrigin: `${indicatorWidth / 2}px ${size / 2 - D.spacing.tightGap}px`,
        transform: `rotate(${currentAngle}deg)`
      }}
    />
  );
}

// A line inside the body, for the minimal knob: the value reads off the body as well as the arc.
const LINE_INDICATOR_FROM = 0.44;
const LINE_INDICATOR_TO = 0.83;
const LINE_INDICATOR_WIDTH = 2;
function KnobLineIndicator({ percentage, size, innerSize, color, dimmed }: { percentage: number; size: number; innerSize: number; color: string; dimmed: boolean }) {
  const center = size / 2, radius = innerSize / 2, angle = (225 + 270 * percentage) * Math.PI / 180;
  const at = (fraction: number) => [center + radius * fraction * Math.sin(angle), center - radius * fraction * Math.cos(angle)];
  const [x1, y1] = at(LINE_INDICATOR_FROM), [x2, y2] = at(LINE_INDICATOR_TO);
  return <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={LINE_INDICATOR_WIDTH} strokeLinecap="round" opacity={dimmed ? O.low : 1} />
  </svg>;
}

// =====================================================
// KNOB TICKS RENDERER
// =====================================================
interface KnobTicksProps {
  value: number;
  min?: number;
  max?: number;
  numTicks?: number;
  size: number;
  scheme: ReturnType<typeof getColorScheme>;
}

function KnobTicks({ value, min = 0, max = 1, numTicks = 11, size, scheme }: KnobTicksProps) {
  const startAngle = 225;
  const endAngle = 495;
  const angleRange = endAngle - startAngle;
  const inactiveTickColor = hexToRgba(scheme.main, O.inactive);

  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < numTicks; i++) {
    const tickValue = min + ((max - min) * i / (numTicks - 1));
    const angle = startAngle + (angleRange * i / (numTicks - 1));
    const isActive = value >= tickValue;

    ticks.push(
      <div
        key={i}
        style={{
          position: 'absolute',
          width: 2,
          height: 6,
          background: isActive ? scheme.main : inactiveTickColor,
          top: 2,
          left: '50%',
          marginLeft: -1,
          transformOrigin: `1px ${size / 2 - 2}px`,
          transform: `rotate(${angle}deg)`,
          borderRadius: 1,
          boxShadow: isActive ? `0 0 3px ${scheme.main}` : 'none'
        }}
      />
    );
  }
  return <>{ticks}</>;
}

// =====================================================
// MAIN KNOB PROPS - Config-based interface
// =====================================================
export interface KnobProps extends ModulationProps {
  /** Value per pixel dragged. Defaults to the config's own. */
  sensitivity?: number;
  value: number;
  onChange?: (value: number) => void;
  label?: string;
  labelIcon?: React.ReactNode;
  displayValue?: string;
  color?: KnobColor;
  className?: string;
  // Range props
  min?: number;
  max?: number;
  unit?: string;
  // Control props
  disabled?: boolean;
  disabledOpacity?: number;
  tooltip?: string;
  showToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (v: boolean) => void;
  // Config-based approach - use one of these:
  /** Use a preset configuration */
  preset?: KnobPresetKey;
  /** Or provide a full config object */
  config?: KnobConfig;
  /** Override individual config properties */
  size?: number;
  layout?: typeof KnobLayout[keyof typeof KnobLayout];
  /** Text alignment for horizontal layout: 'left' (default) = text left of knob, 'right' = text right of knob */
  align?: 'left' | 'right';
}

// =====================================================
// EDITABLE VALUE — click to type a numeric value
// =====================================================

export function EditableValue({ text, color, style, onChange, min, max }: {
  text: string; color: string; style: React.CSSProperties;
  onChange?: (v: number) => void; min: number; max: number;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const raw = parseFloat(inputRef.current?.value ?? '');
    if (!isNaN(raw)) onChange?.(Math.min(max, Math.max(min, raw)));
    setEditing(false);
  };

  if (!editing || !onChange) return <div style={style} onDoubleClick={() => setEditing(true)}>{text}</div>;

  return (
    <input ref={inputRef} autoFocus defaultValue={text.replace(/[^0-9.\-]/g, '')}
      style={{ ...style, background: 'transparent', border: 'none', outline: 'none', color, width: 32, padding: 0 }}
      onBlur={commit} onKeyDown={e => e.key === 'Enter' && commit()} />
  );
}

// =====================================================
// KNOB TOGGLE — small enable/disable button
// =====================================================
function KnobToggle({ active, primaryColor, textColor, knobSize, onToggle }: {
  active: boolean; primaryColor: string; textColor: string; knobSize: number; onToggle: () => void;
}) {
  const s = 7;
  const half = knobSize / 2;
  return (
    <button onClick={onToggle} style={{
      position: 'absolute', top: 1, left: `calc(50% + ${half - s + 1}px)`,
      width: s, height: s, borderRadius: 2,
      background: active ? primaryColor : hexToRgba(textColor, O.dim),
      border: 'none', cursor: 'pointer', padding: 0,
      boxShadow: active ? `0 0 ${D.knob.glowSmall}px ${hexToRgba(primaryColor, O.half)}` : 'none', zIndex: 1
    }} />
  );
}

// =====================================================
// UNIFIED KNOB COMPONENT
// =====================================================
export function Knob({
  value,
  onChange,
  label,
  labelIcon,
  displayValue,
  color = 'cyan',
  className = '',
  min = 0,
  max = 1,
  unit = '',
  disabled = false,
  disabledOpacity,
  tooltip,
  showToggle = false,
  toggleValue = true,
  onToggleChange,
  preset = 'standard',
  config: configProp,
  size: sizeOverride,
  layout: layoutOverride,
  align = 'left',
  sensitivity: sensitivityOverride,
  modulators,
  selectedSource,
  onSelectSource
}: KnobProps) {
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

  // Resolve color using unified utility
  const scheme = getColorScheme(resolveColorType(color), style);

  // Determine if this is an integer knob
  const isInteger = config.valueType === KnobValueType.INTEGER;
  const isDisabled = disabled || (showToggle && !toggleValue);

  // Calculate sensitivity for the range
  const sensitivity = sensitivityOverride ?? getKnobSensitivity(config, max - min);

  // Use shared drag logic
  const { isDragging, isHovered, setIsHovered, handleMouseDown } = useKnobDrag(
    value,
    onChange,
    { min, max, isInteger, disabled: isDisabled, sensitivity }
  );

  // Tooltip handling
  const getTooltipText = useCallback(() => {
    if (tooltip) return tooltip;
    const key = label?.toLowerCase().replace(/\s+/g, '');
    if (key && descriptions?.[key]) return descriptions[key];
    const name = label || 'Knob';
    return `${name}: ${displayValue || value.toFixed(1)} (range: ${min} to ${max})`;
  }, [tooltip, label, displayValue, value, min, max, descriptions]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setTooltip(getTooltipText());
  }, [setTooltip, getTooltipText, setIsHovered]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTooltip(null);
  }, [setTooltip, setIsHovered]);

  const normalizedValue = (value - min) / (max - min);

  // Determine display value
  const valueDisplay = displayValue ?? (isInteger ? `${value} ${unit}`.trim() : undefined);

  // Layout configuration
  const isHorizontal = config.layout === KnobLayout.HORIZONTAL;
  const isKnobOnly = config.layout === KnobLayout.KNOB_ONLY;
  const showTicks = hasFeature(config, KnobFeature.TICKS);
  const showCenterDot = hasFeature(config, KnobFeature.CENTER_DOT);
  const useCutoutLabel = config.labelStyle === KnobLabelStyle.CUTOUT;
  const isRightAligned = align === 'right';

  // Knob element (shared across layouts)
  const knobElement = (
    <div
      data-control-anchor="radial"
      onMouseDown={handleMouseDown}
      style={{
        position: 'relative',
        width: dims.size,
        height: dims.size,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Ticks */}
      {showTicks && (
        <KnobTicks
          value={isInteger ? value : normalizedValue}
          min={isInteger ? min : 0}
          max={isInteger ? max : 1}
          size={dims.size}
          scheme={scheme}
        />
      )}

      {/* Horseshoe ring */}
      <div style={{
        filter: (isDragging || isHovered) ? `drop-shadow(0 0 ${dims.glowRadius}px ${scheme.glow})` : 'none',
        transition: TransitionKeys.normal
      }}>
        <HorseshoeRing
          percentage={normalizedValue}
          color={scheme.main}
          size={dims.size}
          strokeWidth={dims.stroke}
        />
      </div>

      {/* Inner circle */}
      <KnobInnerCircle
        innerSize={dims.innerSize}
        innerPadding={dims.innerPadding}
        size={config.size}
        scheme={scheme}
        style={style}
        isActive={isDragging || isHovered}
        hoverGlow={dims.hoverGlow}
      />

      {/* Center dot */}
      {showCenterDot && (
        <div
          style={{
            position: 'absolute',
            width: 6,
            height: 6,
            top: '50%',
            left: '50%',
            marginTop: -3,
            marginLeft: -3,
            borderRadius: '50%',
            background: scheme.main,
            boxShadow: `0 0 4px ${scheme.main}`,
            opacity: O.medium
          }}
        />
      )}

      {/* Position indicator */}
      {hasFeature(config, KnobFeature.LINE_INDICATOR)
        ? <KnobLineIndicator percentage={normalizedValue} size={dims.size} innerSize={dims.innerSize} color={scheme.main} dimmed={isDisabled} />
        : <KnobIndicator
        percentage={normalizedValue}
        size={dims.size}
        color={scheme.main}
        indicatorWidth={dims.indicatorWidth}
        indicatorHeight={dims.indicatorHeight}
      />}

      {modulators && modulators.length > 0 && !isDisabled && (
        <ModulationRings modulators={modulators} selectedSource={selectedSource} onSelectSource={onSelectSource}
          size={dims.size} radius={(dims.size - dims.stroke) / 2 - RING_INSET} thickness={dims.stroke} fraction={normalizedValue} span={max - min} />
      )}
    </div>
  );

  // Label element
  const labelElement = labelIcon ?? (label && (
    useCutoutLabel ? (
      <div style={{
        fontSize: config.size <= KnobSize.MINI ? T.small.fontSize : T.label.fontSize,
        padding: `${D.spacing.microGap}px ${D.spacing.tightGap * 1.5}px`,
        borderRadius: D.radius.tiny, textTransform: 'uppercase', letterSpacing: T.label.letterSpacing,
        color: scheme.main, background: style.cutoutBackground,
        border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
        boxShadow: getInsetShadow('shallow'), textAlign: 'center',
        fontWeight: T.label.fontWeight, whiteSpace: 'nowrap'
      }}>{label}</div>
    ) : (
      <div style={{
        fontSize: T.small.fontSize, textTransform: 'uppercase', letterSpacing: T.label.letterSpacing,
        color: scheme.main, fontWeight: T.label.fontWeight,
        textAlign: isHorizontal ? (isRightAligned ? 'right' : 'left') : 'center', opacity: O.medium
      }}>{label}</div>
    )
  ));

  // Value element
  const valueElement = valueDisplay && (
    <EditableValue text={valueDisplay} color={scheme.main} min={min} max={max} onChange={onChange}
      style={{
        fontSize: T.small.fontSize, color: scheme.main, fontWeight: T.small.fontWeight,
        textAlign: isHorizontal ? (isRightAligned ? 'right' : 'left') : 'center', opacity: O.high,
        whiteSpace: 'nowrap', cursor: onChange ? 'text' : 'default',
      }} />
  );

  // Horizontal: title above value; vertical: value above title
  const hAlign = isRightAligned ? F.end : F.start;
  const labelValueElement = !isKnobOnly && (valueDisplay || label || labelIcon) && (
    <div style={{
      display: F.flex, flexDirection: F.column as 'column',
      alignItems: isHorizontal ? hAlign : F.center,
      justifyContent: F.center, gap: D.spacing.hairlineGap
    }}>
      {isHorizontal ? <>{labelElement}{valueElement}</> : <>{valueElement}{labelElement}</>}
    </div>
  );

  const hDir = isRightAligned ? F.rowReverse as 'row-reverse' : F.row as 'row';
  const outerDir = isHorizontal ? hDir : F.column as 'column';
  const controlGap = D.spacing.microGap + D.spacing.hairlineGap;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        display: F.flex, flexDirection: outerDir, alignItems: F.center,
        gap: controlGap, opacity: isDisabled ? disabledOpacity ?? O.inactive : 1,
        transition: TransitionKeys.fast, position: 'relative'
      }}
    >
      {showToggle && <KnobToggle active={toggleValue} primaryColor={style.primaryColor} textColor={style.textColor} knobSize={dims.size} onToggle={() => onToggleChange?.(!toggleValue)} />}
      {isHorizontal ? <>{labelValueElement}{knobElement}</> : <>{knobElement}{labelValueElement}</>}
    </div>
  );
}

// =====================================================
// KNOB ROW COMPONENT
// =====================================================
interface KnobData {
  value: number;
  onChange?: (value: number) => void;
  label: string;
  displayValue: string;
  color?: KnobColor;
}

export interface KnobRowProps {
  knobs: KnobData[];
  renderKnob: (data: KnobData, index: number) => React.ReactNode;
  className?: string;
}

export function KnobRow({ knobs, renderKnob, className = '' }: KnobRowProps) {
  const { getEffectiveStyle } = useStyle();
  const style = getEffectiveStyle();

  return (
    <div className={className} style={{ display: F.flex, flexDirection: F.column as 'column', gap: D.spacing.tightGap }}>
      <div style={{ display: F.flex, gap: D.spacing.sectionGap, alignItems: F.end, justifyContent: F.center }}>
        {knobs.map((knob, index) => (
          <div key={index} style={{ display: F.flex, flexDirection: F.column as 'column', alignItems: F.center, gap: D.spacing.microGap }}>
            {renderKnob(knob, index)}
            <div style={{
              fontSize: T.label.fontSize,
              color: getColorScheme(resolveColorType(knob.color), style).main,
              fontWeight: T.label.fontWeight,
              opacity: O.high
            }}>
              {knob.displayValue}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        display: F.flex,
        background: style.cutoutBackground,
        border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
        borderRadius: D.radius.button,
        boxShadow: getInsetShadow('shallow'),
        padding: `${D.spacing.microGap + 2}px ${D.spacing.tightGap * 1.5}px`,
        gap: D.spacing.sectionGap,
        justifyContent: F.center
      }}>
        {knobs.map((knob, index) => (
          <div
            key={index}
            style={{
              fontSize: T.small.fontSize,
              color: getColorScheme(resolveColorType(knob.color), style).main,
              fontWeight: T.label.fontWeight,
              textTransform: 'uppercase',
              letterSpacing: T.label.letterSpacing,
              textAlign: 'center',
              minWidth: 50
            }}
          >
            {knob.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Re-export DualTickRangeKnob for unified knob imports
// =====================================================
export { DualTickRangeKnob } from './lifecycle/DualTickRangeKnob.tsx';

// Re-export config types for convenience
export {
  KnobSize,
  KnobStroke,
  KnobValueType,
  KnobLayout,
  KnobLabelStyle,
  KnobFeature,
  KnobPreset
} from '../../design/constants/KnobConfig.ts';
export type { KnobConfig, KnobPresetKey } from '../../design/constants/KnobConfig.ts';
