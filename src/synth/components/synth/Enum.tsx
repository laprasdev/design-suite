import {OptionsEnum} from '../../../react/inputs/OptionsEnum.tsx';
export {OptionsEnum};
import React, { useState, useCallback, useRef, type RefObject } from 'react';
import {Modal} from '../../../react/Modal.tsx';
import {ModalPlacement} from '../../../react/modalElements.ts';
import { useStyle } from '../../StyleContext.tsx';
import type { AdvancedSettings, StyleTheme } from '../../StyleTypes.ts';
import { getColorScheme, getInsetShadow, hexToRgba, resolveColorType, type ColorScheme } from '../../../color.ts';
import { D, F, C, O, P, T, TransitionKeys, Borders, SIZES, applyCasing } from '../../design/index.ts';
import { useTooltipSafe } from './TooltipContext.tsx';
import { useLongPress } from './base/index.ts';
import { paddingCSS } from '../../design/Composable.ts';
import { CompositionWrap, type HciComposableStyle } from '../../design/designTokensLoader.ts';

export type {EnumColor, EnumVariant, EnumDisplayMode, EnumOption, SingleSelectEnumProps, MultiSelectEnumProps,
  EnumProps} from '../../../react/inputs/enumProps.ts';
import type {EnumOption, SingleSelectEnumProps, MultiSelectEnumProps, EnumProps}
  from '../../../react/inputs/enumProps.ts';

// Type guard for multi-select
function isMultiSelect<T>(props: EnumProps<T>): props is MultiSelectEnumProps<T> {
  return props.variant === 'multi';
}

function useEnumLabel() {
  const { advancedSettings } = useStyle();
  const casing = advancedSettings.enumCasing ?? 'ALL CAPITALS';
  return (opt: EnumOption<any>) => applyCasing(opt.label || String(opt.value), casing);
}

/** What names an option to assistive technology: its tooltip, else its label, else its value. */
const optionName = (option: EnumOption<unknown>) => option.tooltip ?? option.label ?? String(option.value);
/** A native title only for an option drawn without its label (an icon or an image), never repeating a drawn label. */
const undrawnTitle = (option: EnumOption<unknown>, labelDrawn: boolean) =>
  labelDrawn ? undefined : option.tooltip ?? option.label;

// =====================================================
// UNIFIED ENUM COMPONENT
// =====================================================
export function Enum<T = string>(props: EnumProps<T>) {
  const { options, className = '', color = 'cyan', layout, optionComposition, disabled } = props;
  const { getEffectiveStyle, advancedSettings } = useStyle(), style = getEffectiveStyle();
  const scheme = getColorScheme(resolveColorType(color), style);

  if (props.variant === 'cycling') {
    return <CyclingEnumRenderer {...props} scheme={scheme} style={style} className={className} />;
  }
  if (props.variant === 'options') return <OptionsEnum {...props} />;

  const multi = isMultiSelect(props);
  const selection = multi ? multiSelection(props.values, props.onChange, props.primaryValue)
    : singleSelection(props.value, props.onChange);
  const look = ENUM_LOOKS[multi ? props.displayStyle ?? 'default' : 'full'][advancedSettings.enumStyle]({ scheme, style,
    flat: advancedSettings.moduleDisplayMode === 'FLAT', glow: advancedSettings.enumGlowMode === 'GLOW' });
  return <EnumChoices options={options} selection={selection} look={look} layout={layout}
    optionComposition={optionComposition} disabled={disabled} className={className} />;
}

// =====================================================
// SELECTION ABSTRACTION — polymorphic over single/multi
// =====================================================
/** Which options are chosen, which chosen one is primary, and what pressing an option does. */
interface SelectionBehavior<T> {
  isSelected: (value: T) => boolean;
  isPrimary: (value: T) => boolean;
  onSelect: (value: T) => void;
}

function singleSelection<T>(value: T, onChange?: (v: T) => void): SelectionBehavior<T> {
  const isSelected = (v: T) => v === value;
  return { isSelected, isPrimary: isSelected, onSelect: v => onChange?.(v) };
}

function multiSelection<T>(values: T[], onChange: ((vs: T[]) => void) | undefined, primary: T | undefined):
  SelectionBehavior<T> {
  return {
    isSelected: v => values.includes(v),
    isPrimary: v => v === primary,
    onSelect: v => {
      const has = values.includes(v);
      onChange?.(has ? values.filter(x => x !== v) : [...values, v]);
    },
  };
}

// =====================================================
// LOOKS - how each display draws its row and choices
// =====================================================
/** What a look is drawn in: the color's scheme, the theme, and whether modules are flat and chosen choices glow. */
interface EnumPaint { scheme: ColorScheme; style: StyleTheme; flat: boolean; glow: boolean }
/** A choice's parts, drawn by whether it is chosen and whether it is the primary one chosen. */
interface ChoiceLook { button: React.CSSProperties; icon: React.CSSProperties; image: React.CSSProperties;
  label: React.CSSProperties }
interface EnumLook { row: React.CSSProperties; choice: (chosen: boolean, primary: boolean) => ChoiceLook }

const cutoutBorder = (style: StyleTheme) =>
  `${Borders.standard.width}px ${Borders.standard.style} ${style.cutoutBorder}`;
/** A full display's image brightens when chosen; a multi-select's fades when not. */
const fullImage = (chosen: boolean, { scheme }: EnumPaint): React.CSSProperties =>
  ({ filter: chosen ? `brightness(1.3) drop-shadow(0 0 4px ${scheme.main})` : 'opacity(0.5)' });
const multiImage = (chosen: boolean): React.CSSProperties => ({ filter: chosen ? 'none' : 'opacity(0.4)' });
/** A full display's label: lit when chosen, dimmed (or half lit when flat) when not, glowing if `glows`. */
const fullLabel = (chosen: boolean, { scheme, flat }: EnumPaint, dimmed: string, glows: boolean):
  React.CSSProperties => ({
  fontSize: 10, lineHeight: 1, fontWeight: 700,
  color: chosen ? scheme.main : (flat ? hexToRgba(scheme.main, O.medium) : dimmed),
  textShadow: chosen && glows && !flat ? `0 0 8px ${scheme.glow}` : 'none',
});

// Full display, shared back: every choice on one cutout, the chosen one lit or glowing.
function fullShared(paint: EnumPaint): EnumLook {
  const { scheme, style, flat, glow } = paint, dimmed = hexToRgba(scheme.main, O.low);
  const chosenBack = flat || glow ? 'transparent' : dimmed;
  const chosenFilter = !flat && glow ? `drop-shadow(0 0 4px ${scheme.glow}) drop-shadow(0 0 8px ${scheme.glow})`
    : 'none';
  return {
    row: { display: F.inlineFlex, width: 'fit-content', gap: flat ? 0 : D.spacing.microGap,
      background: flat ? 'transparent' : style.cutoutBackground, border: flat ? 'none' : cutoutBorder(style),
      borderRadius: flat ? 0 : D.radius.button, boxShadow: flat ? 'none' : getInsetShadow('medium'),
      padding: flat ? 0 : D.spacing.microGap },
    choice: chosen => ({
      button: { padding: `${D.spacing.tightGap / 2}px ${flat ? D.spacing.tightGap : D.spacing.tightGap * 1.5}px`,
        borderRadius: flat ? 0 : D.radius.tiny, background: chosen ? chosenBack : 'transparent', border: 'none',
        filter: chosen ? chosenFilter : 'none', minWidth: flat ? 'auto' : SIZES.enumMinWidth },
      icon: { color: chosen ? scheme.main : dimmed,
        filter: chosen && glow ? `drop-shadow(0 0 3px ${scheme.main})` : 'none' },
      image: fullImage(chosen, paint),
      label: fullLabel(chosen, paint, dimmed, glow),
    }),
  };
}

// Full display, distinct: each choice its own cutout, the chosen one framed in the color.
function fullDistinct(paint: EnumPaint): EnumLook {
  const { scheme, style, flat } = paint, dimmed = hexToRgba(scheme.main, O.subtle);
  return {
    row: { display: F.flex, flexDirection: F.row as 'row', gap: flat ? 0 : D.spacing.microGap },
    choice: chosen => ({
      button: { padding: flat ? `${D.spacing.tightGap / 2}px ${D.spacing.tightGap}px` : D.spacing.tightGap,
        borderRadius: flat ? 0 : D.radius.tiny, minWidth: flat ? 'auto' : SIZES.enumMinWidth,
        minHeight: flat ? 'auto' : SIZES.enumMinHeight, background: flat ? 'transparent' : style.cutoutBorder,
        opacity: chosen || flat ? 1 : O.medium,
        border: flat ? 'none' : `2px solid ${chosen ? scheme.main : 'transparent'}`,
        boxShadow: flat ? 'none'
          : chosen ? `0 0 8px ${scheme.glow}, ${getInsetShadow('shallow')}` : getInsetShadow('medium') },
      icon: { color: chosen ? scheme.main : dimmed,
        filter: chosen ? `drop-shadow(0 0 6px ${scheme.glow}) drop-shadow(0 0 3px ${scheme.main})` : 'none' },
      image: fullImage(chosen, paint),
      label: fullLabel(chosen, paint, dimmed, true),
    }),
  };
}

// Multi-select, shared back: the choices joined on one cutout, the primary chosen filled in the color.
function multiShared({ scheme, style }: EnumPaint): EnumLook {
  const secondary = hexToRgba(scheme.main, O.medium), unchosen = hexToRgba(scheme.main, O.low);
  return {
    row: { display: F.flex, background: style.cutoutBackground, border: cutoutBorder(style),
      borderRadius: D.radius.button, boxShadow: style.shadowStyle, overflow: 'hidden' },
    choice: (chosen, primary) => {
      const tone = primary ? scheme.main : secondary, halo = primary ? scheme.glow : unchosen;
      return {
        button: { padding: D.spacing.tightGap, minWidth: SIZES.enumMinWidth, minHeight: SIZES.enumMinHeight,
          background: chosen ? tone : 'transparent', color: chosen ? style.backgroundColor : unchosen, border: 'none',
          boxShadow: chosen ? `0 0 12px ${halo}` : 'none', flex: 1, transition: TransitionKeys.fast },
        icon: { color: chosen ? tone : unchosen,
          filter: chosen ? `drop-shadow(0 0 6px ${halo}) drop-shadow(0 0 3px ${tone})` : 'none' },
        image: multiImage(chosen),
        label: { fontSize: 10, color: chosen ? style.backgroundColor : unchosen, fontWeight: 600 },
      };
    },
  };
}

// Multi-select, distinct: each choice its own cutout, the primary chosen framed brightest.
function multiDistinct({ scheme, style }: EnumPaint): EnumLook {
  const secondary = hexToRgba(scheme.main, O.medium), unchosen = hexToRgba(scheme.main, O.low);
  return {
    row: { display: F.flex, flexDirection: F.row as 'row', gap: D.spacing.microGap },
    choice: (chosen, primary) => {
      const tone = primary ? scheme.main : secondary;
      return {
        button: { padding: D.spacing.tightGap, borderRadius: D.radius.tiny, minWidth: SIZES.enumMinWidth,
          minHeight: SIZES.enumMinHeight, background: style.cutoutBackground, opacity: chosen ? 1 : 0.5,
          border: `2px solid ${chosen ? (primary ? hexToRgba(scheme.main, O.high) : secondary) : style.cutoutBorder}`,
          boxShadow: chosen ? `${primary ? scheme.glow : unchosen}, ${style.shadowStyle}` : style.shadowStyle,
          transition: TransitionKeys.fast },
        icon: { color: chosen ? tone : unchosen },
        image: multiImage(chosen),
        label: { fontSize: 10, color: chosen ? tone : unchosen, fontWeight: 600 },
      };
    },
  };
}

/** Each display's look in each enum style: the full display (one value, or several drawn alike) and the
 *  multi-select's own (several, one of them primary). */
const ENUM_LOOKS: Readonly<Record<NonNullable<MultiSelectEnumProps['displayStyle']>,
  Readonly<Record<AdvancedSettings['enumStyle'], (paint: EnumPaint) => EnumLook>>>> = Object.freeze({
  full: { 'SHARED BACK': fullShared, DISTINCT: fullDistinct },
  default: { 'SHARED BACK': multiShared, DISTINCT: multiDistinct },
});

// =====================================================
// CHOICES - every option in view, drawn in a look
// =====================================================
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

interface EnumChoicesProps<T> {
  options: EnumOption<T>[];
  selection: SelectionBehavior<T>;
  look: EnumLook;
  layout?: HciComposableStyle;
  optionComposition?: HciComposableStyle;
  disabled?: boolean;
  className: string;
}

function EnumChoices<T>({ options, selection, look, layout, optionComposition, disabled, className }:
  EnumChoicesProps<T>) {
  const fmtLabel = useEnumLabel();
  const { setTooltip } = useTooltipSafe();
  return (
    <div className={className} style={{ ...look.row, ...enumGridStyle(layout) }}>
      {options.map((option, index) => {
        const chosen = selection.isSelected(option.value);
        const drawn = look.choice(chosen, selection.isPrimary(option.value));
        const labelled = !option.icon && !option.image;
        return (
          <button
            key={index} disabled={disabled} aria-pressed={chosen}
            aria-label={optionName(option)} title={undrawnTitle(option, labelled)}
            onFocus={() => setTooltip(option.tooltip ?? option.label ?? null)} onBlur={() => setTooltip(null)}
            onClick={() => selection.onSelect(option.value)}
            onMouseEnter={() => option.tooltip && setTooltip(option.tooltip)}
            onMouseLeave={() => option.tooltip && setTooltip(null)}
            style={{ display: F.flex, alignItems: F.center, justifyContent: F.center, ...drawn.button,
              cursor: disabled ? C.default : C.pointer, ...enumGridCellStyle(layout, optionComposition) }}
          >
            {option.icon && <div style={drawn.icon}>{option.icon}</div>}
            {option.image && <img src={option.image} alt={option.label || String(option.value)}
              style={{ width: '100%', height: '100%', objectFit: 'contain', ...drawn.image }} />}
            {labelled && <span style={drawn.label}>{fmtLabel(option)}</span>}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// FLOATING GRID PICKER - Opens above cycling enum on long-press
// =====================================================

function getGridColumns(count: number): number {
  return count <= 6 ? count : Math.ceil(Math.sqrt(count));
}

interface FloatingGridPickerProps<T> {
  options: EnumOption<T>[];
  value: T;
  scheme: ColorScheme;
  anchor: RefObject<HTMLDivElement | null>;
  onSelect: (value: T) => void;
  onDismiss: () => void;
}

function GridCell<T>({ option, isSelected, scheme, onSelect }: {
  option: EnumOption<T>; isSelected: boolean; scheme: ColorScheme; onSelect: (v: T) => void;
}) {
  const fmtLabel = useEnumLabel();
  return (
    <button
      onClick={() => onSelect(option.value)} aria-label={optionName(option)} title={option.tooltip}
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

// An anchored Modal above its control: Escape at the control or in the grid, or a press outside both, dismisses it.
// Its own presses stay off the control's long press.
function FloatingGridPicker<T>({ options, value, scheme, anchor, onSelect, onDismiss }: FloatingGridPickerProps<T>) {
  const cols = getGridColumns(options.length);
  return (
    <Modal open placement={ModalPlacement.ANCHORED} anchor={anchor} onClose={onDismiss}
      onMouseDown={event => event.stopPropagation()} onMouseUp={event => event.stopPropagation()} style={{
        position: P.absolute as 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: D.spacing.microGap,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: D.spacing.microGap,
        padding: D.spacing.tightGap,
      }}>
      {options.map((opt, i) => (
        <GridCell key={i} option={opt} isSelected={opt.value === value} scheme={scheme} onSelect={onSelect} />
      ))}
    </Modal>
  );
}

// =====================================================
// CYCLING ENUM RENDERER
// =====================================================
interface CyclingRendererProps<T> {
  options: EnumOption<T>[];
  scheme: ColorScheme;
  style: StyleTheme;
  className?: string;
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
    <button className={className} style={buttonStyle} aria-label={optionName(option)}
      title={undrawnTitle(option, !option.icon)} aria-haspopup="dialog" aria-expanded={expanded}
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
  const root = useRef<HTMLDivElement>(null);
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
    <div ref={root} style={{ position: P.relative as 'relative' }}
      {...bind}
      onMouseEnter={() => { setIsHovered(true); setTooltip(currentOption.tooltip ?? currentOption.label ?? null); }}
      onMouseLeave={() => { setIsHovered(false); setTooltip(null); bind.onMouseLeave(); }}
      onFocus={() => setTooltip(currentOption.tooltip ?? currentOption.label ?? null)}
      onBlur={() => setTooltip(null)}
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
        <FloatingGridPicker options={options} value={value} scheme={scheme} anchor={root}
          onSelect={handlePickerSelect} onDismiss={() => setPickerOpen(false)} />
      )}
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
