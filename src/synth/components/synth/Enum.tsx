import {OptionsEnum} from '../../../react/inputs/OptionsEnum.tsx';
export {OptionsEnum};
import React, { useState, useCallback } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { getColorScheme, mapLegacyColor, getInsetShadow, hexToRgba, type ColorType } from '../../../color.ts';
import { D, F, C, O, P, T, TransitionKeys, Borders, SIZES, applyCasing } from '../../design/index.ts';
import { useTooltipSafe } from './TooltipContext.tsx';
import { useLongPress } from './base/index.ts';
import { paddingCSS } from '../../design/Composable.ts';
import { CompositionWrap, type HciComposableStyle } from '../../design/designTokensLoader.ts';

// =====================================================
// UNIFIED ENUM COMPONENT
// Replaces: BaseFullDisplayEnum, CyclingEnum, MultiSelectEnum
// =====================================================

export type EnumColor = 'primary' | 'secondary' | 'tertiary' | 'cyan' | 'pink' | 'green';
export type EnumVariant = 'full' | 'cycling' | 'multi' | 'options';
export type EnumDisplayMode = 'shared' | 'distinct';

export interface EnumOption<T = string> {
  value: T;
  label?: string;
  icon?: React.ReactNode;
  image?: string;
  tooltip?: string;
}

// =====================================================
// BASE ENUM PROPS
// =====================================================
interface BaseEnumProps<T = string> {
  options: EnumOption<T>[];
  className?: string;
  color?: EnumColor;
  layout?: HciComposableStyle;
  optionComposition?: HciComposableStyle;
  disabled?: boolean;
}

// =====================================================
// SINGLE SELECT PROPS (full, cycling)
// =====================================================
export interface SingleSelectEnumProps<T = string> extends BaseEnumProps<T> {
  value: T;
  onChange?: (value: T) => void;
  variant?: 'full' | 'cycling' | 'options';
  /** Size in px for cycling variant button (default: uses SIZES.enumMinWidth) */
  size?: number;
  /** How many columns the options form lays its choices in. */
  columns?: number;
  /** The options form with several lit at once, for a flags value. Takes the place of `value`. */
  litValues?: T[];
}

// =====================================================
// MULTI SELECT PROPS
// =====================================================
export interface MultiSelectEnumProps<T = string> extends BaseEnumProps<T> {
  values: T[];
  onChange?: (values: T[]) => void;
  primaryValue?: T;
  variant: 'multi';
  displayStyle?: 'default' | 'full';
}

// Union type for all enum props
export type EnumProps<T = string> = SingleSelectEnumProps<T> | MultiSelectEnumProps<T>;

// Type guard for multi-select
function isMultiSelect<T>(props: EnumProps<T>): props is MultiSelectEnumProps<T> {
  return props.variant === 'multi';
}

function useEnumLabel() {
  const { advancedSettings } = useStyle();
  const casing = advancedSettings.enumCasing ?? 'ALL CAPITALS';
  return (opt: EnumOption<any>) => applyCasing(opt.label || String(opt.value), casing);
}

// =====================================================
// UNIFIED ENUM COMPONENT
// =====================================================
export function Enum<T = string>(props: EnumProps<T>) {
  const { options, className = '', color = 'cyan', layout, optionComposition, disabled } = props;
  const { getEffectiveStyle, advancedSettings } = useStyle();
  const style = getEffectiveStyle();

  // Normalize color to ColorType
  const colorType: ColorType = ['primary', 'secondary', 'tertiary'].includes(color)
    ? color as ColorType
    : mapLegacyColor(color as 'cyan' | 'pink' | 'green');

  const scheme = getColorScheme(colorType, style);
  const isSharedBack = advancedSettings.enumStyle === 'SHARED BACK';
  const isGlowMode = advancedSettings.enumGlowMode === 'GLOW';

  // Route to appropriate renderer
  if (props.variant === 'cycling') {
    return (
      <CyclingEnumRenderer
        {...props as SingleSelectEnumProps<T>}
        scheme={scheme}
        style={style}
        className={className}
      />
    );
  }

  if (props.variant === 'options') {
    return <OptionsEnum {...props as SingleSelectEnumProps<T>} />;
  }

  if (isMultiSelect(props)) {
    if (props.displayStyle === 'full') {
      const sel = multiSelection(props.values, props.onChange);
      return isSharedBack
        ? <FullSharedRenderer options={options} {...sel} layout={layout} optionComposition={optionComposition} disabled={disabled} scheme={scheme} style={style} isGlowMode={isGlowMode} className={className} />
        : <FullDistinctRenderer options={options} {...sel} layout={layout} optionComposition={optionComposition} disabled={disabled} scheme={scheme} style={style} className={className} />;
    }
    return isSharedBack
      ? <MultiSharedRenderer {...props} scheme={scheme} style={style} isGlowMode={isGlowMode} />
      : <MultiDistinctRenderer {...props} scheme={scheme} style={style} />;
  }

  // Default: full display single select
  const singleProps = props as SingleSelectEnumProps<T>;
  const sel = singleSelection(singleProps.value, singleProps.onChange);
  return isSharedBack
    ? <FullSharedRenderer options={options} {...sel} layout={layout} optionComposition={optionComposition} disabled={disabled} scheme={scheme} style={style} isGlowMode={isGlowMode} className={className} />
    : <FullDistinctRenderer options={options} {...sel} layout={layout} optionComposition={optionComposition} disabled={disabled} scheme={scheme} style={style} className={className} />;
}

// =====================================================
// SELECTION ABSTRACTION — polymorphic over single/multi
// =====================================================
interface SelectionBehavior<T> {
  isSelected: (value: T) => boolean;
  onSelect: (value: T) => void;
}

function singleSelection<T>(value: T, onChange?: (v: T) => void): SelectionBehavior<T> {
  return { isSelected: v => v === value, onSelect: v => onChange?.(v) };
}

function multiSelection<T>(values: T[], onChange?: (vs: T[]) => void): SelectionBehavior<T> {
  return {
    isSelected: v => values.includes(v),
    onSelect: v => {
      const has = values.includes(v);
      onChange?.(has ? values.filter(x => x !== v) : [...values, v]);
    },
  };
}

// =====================================================
// FULL DISPLAY - SHARED BACK RENDERER
// =====================================================
interface RendererProps<T> {
  options: EnumOption<T>[];
  scheme: ReturnType<typeof getColorScheme>;
  style: ReturnType<typeof useStyle>['getEffectiveStyle'] extends () => infer R ? R : never;
  className?: string;
}

interface FullRendererProps<T> extends RendererProps<T>, SelectionBehavior<T> {
  layout?: HciComposableStyle;
  optionComposition?: HciComposableStyle;
  disabled?: boolean;
  isGlowMode?: boolean;
}

interface SingleRendererProps<T> extends RendererProps<T> {
  value: T;
  onChange?: (value: T) => void;
  isGlowMode?: boolean;
}

function enumGridStyle(layout?: HciComposableStyle): React.CSSProperties {
  if (layout?.wrap !== CompositionWrap.WRAP || !layout.minimumCellWidth) return {};
  return { display: 'grid', width: '100%', gridTemplateColumns: `repeat(auto-fit, minmax(${layout.minimumCellWidth}px, 1fr))`,
    maxWidth: layout.maximumColumns ? layout.minimumCellWidth * layout.maximumColumns + (layout.spacing?.gap ?? D.spacing.microGap) * (layout.maximumColumns - 1) : undefined,
    gap: layout.spacing?.gap ?? D.spacing.microGap, padding: 0 };
}

function enumGridCellStyle(layout?: HciComposableStyle, option?: HciComposableStyle): React.CSSProperties {
  if (layout?.wrap !== CompositionWrap.WRAP || !layout.minimumCellWidth) return {};
  return { width: '100%', minWidth: 0, height: option?.sizing?.sizeY ?? layout.minimumCellWidth,
    minHeight: 0, padding: paddingCSS(option?.spacing?.padding) ?? 0, boxSizing: 'border-box' };
}

function FullSharedRenderer<T>({ options, isSelected: isSel, onSelect, scheme, style, isGlowMode = false, className = '', layout, optionComposition, disabled }: FullRendererProps<T>) {
  const { advancedSettings } = useStyle();
  const fmtLabel = useEnumLabel();
  const { setTooltip } = useTooltipSafe();
  const isFlat = advancedSettings.moduleDisplayMode === 'FLAT';
  const dimmedColor = hexToRgba(scheme.main, O.low);

  return (
    <div
      className={className}
      style={{
        display: F.inlineFlex,
        width: 'fit-content',
        gap: isFlat ? 0 : D.spacing.microGap,
        background: isFlat ? 'transparent' : style.cutoutBackground,
        border: isFlat ? 'none' : `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
        borderRadius: isFlat ? 0 : D.radius.button,
        boxShadow: isFlat ? 'none' : getInsetShadow('medium'),
        padding: isFlat ? 0 : D.spacing.microGap, ...enumGridStyle(layout)
      }}
    >
      {options.map((option, index) => {
        const selected = isSel(option.value);

        const selectedStyle = isFlat
          ? { background: 'transparent', filter: 'none' }
          : isGlowMode
          ? { background: 'transparent', filter: `drop-shadow(0 0 4px ${scheme.glow}) drop-shadow(0 0 8px ${scheme.glow})` }
          : { background: hexToRgba(scheme.main, O.low), filter: 'none' };

        return (
          <button
            key={index} disabled={disabled} aria-pressed={selected}
            aria-label={option.tooltip ?? option.label ?? String(option.value)} title={option.tooltip ?? option.label}
            onFocus={() => setTooltip(option.tooltip ?? option.label ?? null)} onBlur={() => setTooltip(null)}
            onClick={() => onSelect(option.value)}
            onMouseEnter={() => option.tooltip && setTooltip(option.tooltip)}
            onMouseLeave={() => option.tooltip && setTooltip(null)}
            style={{
              display: F.flex, alignItems: F.center, justifyContent: F.center,
              padding: isFlat ? `${D.spacing.tightGap / 2}px ${D.spacing.tightGap}px` : `${D.spacing.tightGap / 2}px ${D.spacing.tightGap * 1.5}px`,
              borderRadius: isFlat ? 0 : D.radius.tiny,
              background: selected ? selectedStyle.background : 'transparent',
              border: 'none', filter: selected ? selectedStyle.filter : 'none',
              cursor: disabled ? C.default : C.pointer, minWidth: isFlat ? 'auto' : SIZES.enumMinWidth,
              ...enumGridCellStyle(layout, optionComposition)
            }}
          >
            {option.icon && (
              <div style={{ color: selected ? scheme.main : dimmedColor, filter: selected && isGlowMode ? `drop-shadow(0 0 3px ${scheme.main})` : 'none' }}>
                {option.icon}
              </div>
            )}
            {!option.icon && (
              <span style={{ fontSize: 10, lineHeight: 1, color: selected ? scheme.main : (isFlat ? hexToRgba(scheme.main, O.medium) : dimmedColor), fontWeight: 700, textShadow: selected && isGlowMode && !isFlat ? `0 0 8px ${scheme.glow}` : 'none' }}>
                {fmtLabel(option)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// FULL DISPLAY - DISTINCT RENDERER
// =====================================================
function FullDistinctRenderer<T>({ options, isSelected: isSel, onSelect, scheme, style, className = '', layout, optionComposition, disabled }: FullRendererProps<T>) {
  const { advancedSettings } = useStyle();
  const fmtLabel = useEnumLabel();
  const { setTooltip } = useTooltipSafe();
  const isFlat = advancedSettings.moduleDisplayMode === 'FLAT';
  const dimmedColor = hexToRgba(scheme.main, O.subtle);

  return (
    <div style={{ display: F.flex, flexDirection: F.row as 'row', gap: isFlat ? 0 : D.spacing.microGap, ...enumGridStyle(layout) }} className={className}>
      {options.map((option, index) => {
        const selected = isSel(option.value);

        return (
          <button
            key={index} disabled={disabled} aria-pressed={selected}
            aria-label={option.tooltip ?? option.label ?? String(option.value)} title={option.tooltip ?? option.label}
            onFocus={() => setTooltip(option.tooltip ?? option.label ?? null)} onBlur={() => setTooltip(null)}
            onClick={() => onSelect(option.value)}
            onMouseEnter={() => option.tooltip && setTooltip(option.tooltip)}
            onMouseLeave={() => option.tooltip && setTooltip(null)}
            style={{
              display: F.flex, alignItems: F.center, justifyContent: F.center,
              padding: isFlat ? `${D.spacing.tightGap / 2}px ${D.spacing.tightGap}px` : D.spacing.tightGap,
              borderRadius: isFlat ? 0 : D.radius.tiny,
              minWidth: isFlat ? 'auto' : SIZES.enumMinWidth,
              minHeight: isFlat ? 'auto' : SIZES.enumMinHeight,
              background: isFlat ? 'transparent' : style.cutoutBorder,
              opacity: selected ? 1 : (isFlat ? 1 : O.medium),
              border: isFlat ? 'none' : (selected ? `2px solid ${scheme.main}` : '2px solid transparent'),
              boxShadow: isFlat ? 'none' : (selected
                ? `0 0 8px ${scheme.glow}, ${getInsetShadow('shallow')}`
                : getInsetShadow('medium')),
              cursor: disabled ? C.default : C.pointer, ...enumGridCellStyle(layout, optionComposition)
            }}
          >
            {option.icon && (
              <div style={{ color: selected ? scheme.main : dimmedColor, filter: selected ? `drop-shadow(0 0 6px ${scheme.glow}) drop-shadow(0 0 3px ${scheme.main})` : 'none' }}>
                {option.icon}
              </div>
            )}
            {option.image && (
              <img src={option.image} alt={option.label || String(option.value)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', filter: selected ? `brightness(1.3) drop-shadow(0 0 4px ${scheme.main})` : 'opacity(0.5)' }} />
            )}
            {!option.icon && !option.image && (
              <span style={{ fontSize: 10, lineHeight: 1, color: selected ? scheme.main : (isFlat ? hexToRgba(scheme.main, O.medium) : dimmedColor), fontWeight: 700, textShadow: selected && !isFlat ? `0 0 8px ${scheme.glow}` : 'none' }}>
                {fmtLabel(option)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// OPTIONS - Every choice in view on a module's grid, wrapping to fit
// =====================================================
// Given `columns`, the choices keep to that many column lines. Without, each takes the room its words need and they wrap to another row rather than cut a word.
// =====================================================
// FLOATING GRID PICKER - Opens above cycling enum on long-press
// =====================================================

function getGridColumns(count: number): number {
  return count <= 6 ? count : Math.ceil(Math.sqrt(count));
}

interface FloatingGridPickerProps<T> {
  options: EnumOption<T>[];
  value: T;
  scheme: ReturnType<typeof getColorScheme>;
  style: ReturnType<typeof useStyle>['getEffectiveStyle'] extends () => infer R ? R : never;
  onSelect: (value: T) => void;
  onDismiss: () => void;
}

function GridCell<T>({ option, isSelected, scheme, onSelect }: {
  option: EnumOption<T>; isSelected: boolean; scheme: ReturnType<typeof getColorScheme>; onSelect: (v: T) => void;
}) {
  const fmtLabel = useEnumLabel();
  return (
    <button
      onClick={() => onSelect(option.value)} aria-label={option.tooltip ?? option.label ?? String(option.value)} title={option.tooltip}
      style={{
        padding: D.spacing.tightGap,
        background: isSelected ? hexToRgba(scheme.main, O.low) : 'transparent',
        border: 'none',
        borderRadius: D.radius.tiny,
        cursor: C.pointer,
        boxShadow: isSelected ? `0 0 8px ${scheme.glow}` : 'none'
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: isSelected ? scheme.main : hexToRgba(scheme.main, O.medium) }}>
        {fmtLabel(option)}
      </span>
    </button>
  );
}

function FloatingGridPicker<T>({ options, value, scheme, style, onSelect, onDismiss }: FloatingGridPickerProps<T>) {
  const cols = getGridColumns(options.length);
  return (
    <>
      <div style={{ position: P.fixed as 'fixed', inset: 0, zIndex: 999 }} onClick={onDismiss} />
      <div role="dialog" onMouseDown={event => event.stopPropagation()} onMouseUp={event => event.stopPropagation()} style={{
        position: P.absolute as 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: D.spacing.microGap,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: D.spacing.microGap,
        padding: D.spacing.tightGap,
        background: style.borderColor,
        border: `1px solid ${style.cutoutBorder}`,
        borderRadius: D.radius.button,
        boxShadow: getInsetShadow('medium'),
        zIndex: 1000
      }}>
        {options.map((opt, i) => (
          <GridCell key={i} option={opt} isSelected={opt.value === value} scheme={scheme} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

// =====================================================
// CYCLING ENUM RENDERER
// =====================================================
interface CyclingRendererProps<T> extends RendererProps<T> {
  layout?: HciComposableStyle;
  value: T;
  onChange?: (value: T) => void;
  size?: number;
}

function CyclingButton<T>({ option, color, fontSize, style: buttonStyle, className, onCycle, onOpen, expanded }: {
  option: EnumOption<T>; color: string; fontSize: number; style: React.CSSProperties; className?: string;
  onCycle: () => void; onOpen: () => void; expanded: boolean;
}) {
  const fmtLabel = useEnumLabel();
  return (
    <button className={className} style={buttonStyle} aria-label={option.tooltip ?? option.label ?? String(option.value)}
      title={option.tooltip ?? option.label} aria-haspopup="dialog" aria-expanded={expanded}
      onClick={event => { if (event.detail === 0) onCycle(); }}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); onOpen(); } }}>
      {option?.icon && <div style={{ color }}>{option.icon}</div>}
      {!option?.icon && (
        <span style={{ fontSize, color, fontWeight: 700, lineHeight: 1 }}>{fmtLabel(option)}</span>
      )}
    </button>
  );
}

function cyclingGeometry(layout: HciComposableStyle | undefined, size?: number) {
  const unframed = layout?.border?.borderEdges?.length === 0;
  const intrinsic = Math.max(layout?.text?.size ?? T.value.fontSize, layout?.glyph?.size ?? 0)
    + (layout?.spacing?.padding?.at(-1) ?? 0) * 2;
  const compact = unframed || size != null || Boolean(layout?.sizing?.sizeY);
  const boxHeight = size ?? layout?.sizing?.sizeY ?? (unframed ? intrinsic : SIZES.enumMinHeight);
  return { unframed, compact, boxHeight, boxWidth: layout?.sizing?.sizeX ?? boxHeight };
}

function CyclingEnumRenderer<T>({ options, value, onChange, scheme, style, size, layout, className = '' }: CyclingRendererProps<T>) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { setTooltip } = useTooltipSafe();

  const currentIndex = options.findIndex(opt => opt.value === value);
  const currentOption = options[currentIndex] || options[0];

  const cycleNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % options.length;
    onChange?.(options[nextIndex].value);
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
  }, [currentIndex, options, onChange]);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const handlePickerSelect = useCallback((v: T) => { onChange?.(v); setPickerOpen(false); }, [onChange]);
  const { bind } = useLongPress({ onShortPress: cycleNext, onLongPress: openPicker });

  // Sizing: when `size` is given, use compact styling; otherwise use default enum sizing
  const { unframed, compact, boxHeight, boxWidth } = cyclingGeometry(layout, size);
  const fontSize = layout?.text?.size ?? (compact ? T.value.fontSize : T.title.fontSize - 1);
  const pad = compact ? 0 : D.spacing.tightGap;

  const normalColor = hexToRgba(scheme.main, O.high);
  const hoverColor = hexToRgba(scheme.main, O.hover);
  const pressedColor = style.secondaryColor;
  const currentColor = isPressed ? pressedColor : (isHovered ? hoverColor : normalColor);

  const borderColor = isHovered || isPressed
    ? (isPressed ? pressedColor : hoverColor)
    : 'transparent';

  const currentShadow = isPressed
    ? `0 0 6px ${hexToRgba(pressedColor, O.high)}`
    : (isHovered ? `0 0 6px ${scheme.glow}` : 'none');

  return (
    <div style={{ position: P.relative as 'relative' }}
      {...bind}
      onMouseEnter={() => { setIsHovered(true); setTooltip(currentOption.tooltip ?? currentOption.label ?? null); }}
      onMouseLeave={() => { setIsHovered(false); setTooltip(null); bind.onMouseLeave(); }}
      onFocus={() => setTooltip(currentOption.tooltip ?? currentOption.label ?? null)}
      onBlur={() => setTooltip(null)}
      onKeyDown={event => { if (event.key === 'Escape') setPickerOpen(false); }}
    >
      <CyclingButton
        option={currentOption} onCycle={cycleNext} onOpen={openPicker} expanded={pickerOpen}
        color={currentColor}
        fontSize={fontSize}
        className={className}
        style={{
          display: F.flex, alignItems: F.center, justifyContent: F.center,
          height: boxHeight, padding: pad,
          borderRadius: unframed ? 0 : compact ? D.radius.tiny : D.radius.button,
          background: unframed ? 'transparent' : compact ? hexToRgba(scheme.main, O.low) : style.cutoutBorder,
          border: unframed ? 0 : compact ? `1px solid ${scheme.main}` : `1px solid ${borderColor}`,
          boxShadow: unframed ? 'none' : compact ? `0 0 4px ${hexToRgba(scheme.main, O.medium)}` : currentShadow,
          cursor: C.pointer, transition: TransitionKeys.fast,
          ...(compact ? { width: boxWidth, flexShrink: 0 } : { minWidth: SIZES.enumMinWidth + D.spacing.tightGap, width: 'max-content' }),
        }}
      />
      {pickerOpen && (
        <FloatingGridPicker options={options} value={value} scheme={scheme} style={style}
          onSelect={handlePickerSelect} onDismiss={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

// =====================================================
// MULTI SELECT - SHARED BACK RENDERER
// =====================================================
interface MultiRendererProps<T> extends RendererProps<T> {
  values: T[];
  onChange?: (values: T[]) => void;
  primaryValue?: T;
  isGlowMode?: boolean;
}

function MultiSharedRenderer<T>({ options, values, onChange, scheme, style, primaryValue, isGlowMode = false, className = '' }: MultiRendererProps<T>) {
  const fmtLabel = useEnumLabel();
  const { setTooltip } = useTooltipSafe();
  const toggleValue = (optionValue: T) => {
    const isSelected = values.includes(optionValue);
    const newValues = isSelected
      ? values.filter(v => v !== optionValue)
      : [...values, optionValue];
    onChange?.(newValues);
  };

  const secondaryColor = hexToRgba(scheme.main, O.medium);
  const unselectedColor = hexToRgba(scheme.main, O.low);

  return (
    <div
      className={className}
      style={{
        display: F.flex,
        background: style.cutoutBackground,
        border: `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`,
        borderRadius: D.radius.button,
        boxShadow: style.shadowStyle,
        overflow: 'hidden'
      }}
    >
      {options.map((option, index) => {
        const isSelected = values.includes(option.value);
        const isPrimary = primaryValue === option.value;

        return (
          <button
            key={index}
            onClick={() => toggleValue(option.value)}
            onMouseEnter={() => option.tooltip && setTooltip(option.tooltip)}
            onMouseLeave={() => option.tooltip && setTooltip(null)}
            style={{
              display: F.flex,
              alignItems: F.center,
              justifyContent: F.center,
              padding: D.spacing.tightGap,
              minWidth: SIZES.enumMinWidth,
              minHeight: SIZES.enumMinHeight,
              background: isSelected
                ? (isPrimary ? scheme.main : secondaryColor)
                : 'transparent',
              color: isSelected ? style.backgroundColor : unselectedColor,
              borderRight: index < options.length - 1 ? `1px solid ${style.cutoutBorder}` : 'none',
              border: 'none',
              boxShadow: isSelected
                ? `0 0 12px ${isPrimary ? scheme.glow : hexToRgba(scheme.main, O.low)}`
                : 'none',
              flex: 1,
              cursor: C.pointer,
              transition: TransitionKeys.fast
            }}
          >
            {option.icon && (
              <div style={{
                color: isSelected
                  ? (isPrimary ? scheme.main : secondaryColor)
                  : unselectedColor,
                filter: isSelected
                  ? `drop-shadow(0 0 6px ${isPrimary ? scheme.glow : hexToRgba(scheme.main, O.low)}) drop-shadow(0 0 3px ${isPrimary ? scheme.main : secondaryColor})`
                  : 'none'
              }}>
                {option.icon}
              </div>
            )}
            {option.image && (
              <img
                src={option.image}
                alt={option.label || String(option.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: isSelected ? 'none' : 'opacity(0.4)'
                }}
              />
            )}
            {!option.icon && !option.image && (
              <span
                style={{
                  fontSize: 10,
                  color: isSelected
                    ? style.backgroundColor
                    : unselectedColor,
                  fontWeight: 600
                }}
              >
                {fmtLabel(option)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// MULTI SELECT - DISTINCT RENDERER
// =====================================================
function MultiDistinctRenderer<T>({ options, values, onChange, scheme, style, primaryValue, className = '' }: MultiRendererProps<T>) {
  const fmtLabel = useEnumLabel();
  const { setTooltip } = useTooltipSafe();
  const toggleValue = (optionValue: T) => {
    const isSelected = values.includes(optionValue);
    const newValues = isSelected
      ? values.filter(v => v !== optionValue)
      : [...values, optionValue];
    onChange?.(newValues);
  };

  const primaryBorder = hexToRgba(scheme.main, O.high);
  const secondaryBorder = hexToRgba(scheme.main, O.medium);
  const secondaryColor = hexToRgba(scheme.main, O.medium);
  const unselectedColor = hexToRgba(scheme.main, O.low);

  return (
    <div style={{ display: F.flex, flexDirection: F.row as 'row', gap: D.spacing.microGap }} className={className}>
      {options.map((option, index) => {
        const isSelected = values.includes(option.value);
        const isPrimary = primaryValue === option.value;

        return (
          <button
            key={index}
            onClick={() => toggleValue(option.value)}
            onMouseEnter={() => option.tooltip && setTooltip(option.tooltip)}
            onMouseLeave={() => option.tooltip && setTooltip(null)}
            style={{
              display: F.flex,
              alignItems: F.center,
              justifyContent: F.center,
              padding: D.spacing.tightGap,
              borderRadius: D.radius.tiny,
              minWidth: SIZES.enumMinWidth,
              minHeight: SIZES.enumMinHeight,
              background: style.cutoutBackground,
              opacity: isSelected ? 1 : 0.5,
              border: isSelected
                ? `2px solid ${isPrimary ? primaryBorder : secondaryBorder}`
                : `2px solid ${style.cutoutBorder}`,
              boxShadow: isSelected
                ? `${isPrimary ? scheme.glow : hexToRgba(scheme.main, O.low)}, ${style.shadowStyle}`
                : style.shadowStyle,
              cursor: C.pointer,
              transition: TransitionKeys.fast
            }}
          >
            {option.icon && (
              <div style={{
                color: isSelected
                  ? (isPrimary ? scheme.main : secondaryColor)
                  : unselectedColor
              }}>
                {option.icon}
              </div>
            )}
            {option.image && (
              <img
                src={option.image}
                alt={option.label || String(option.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: isSelected ? 'none' : 'opacity(0.4)'
                }}
              />
            )}
            {!option.icon && !option.image && (
              <span
                style={{
                  fontSize: 10,
                  color: isSelected
                    ? (isPrimary ? scheme.main : secondaryColor)
                    : unselectedColor,
                  fontWeight: 600
                }}
              >
                {fmtLabel(option)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// CONVENIENCE EXPORTS for backwards compatibility
// =====================================================

export function BaseFullDisplayEnum<T = string>(props: Omit<SingleSelectEnumProps<T>, 'variant'>) {
  return <Enum {...props} variant="full" />;
}

export function CyclingEnum<T = string>(props: Omit<SingleSelectEnumProps<T>, 'variant'>) {
  return <Enum {...props} variant="cycling" />;
}

export function MultiSelectEnum<T = string>(props: Omit<MultiSelectEnumProps<T>, 'variant'> & { variant?: never }) {
  return <Enum {...props} variant="multi" />;
}

export function SelectEnum<T extends string | number>({ options, value, onChange }: Omit<SingleSelectEnumProps<T>, 'variant'>) {
  const style = useStyle().getEffectiveStyle();
  return <select value={value} disabled={!onChange} onChange={event => {
    const selected = options.find(option => String(option.value) === event.target.value);
    if (selected) onChange?.(selected.value);
  }} style={{ ...T.value, color: style.textColor, background: style.cutoutBackground,
    border: `${Borders.standard.width}px solid ${style.cutoutBorder}`, borderRadius: D.radius.button,
    padding: D.spacing.tightGap, minWidth: 0, maxWidth: '100%' }}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
