import React from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { hexToRgba } from '../../../color.ts';
import { LayoutDimensions } from '../../../layout.ts';
import { D, DC, O, S, SYNTH_LABEL, STRIP_LABEL, TransitionKeys, Borders } from '../../design/index.ts';

// =====================================================
// TAB STRIP — flush edge-to-edge cells with dividers
// =====================================================

/** @deprecated Use D.accent.thick */
export const ENABLE_LINE_H = LayoutDimensions.accent.thick;

const StripAccentContext = React.createContext<number>(LayoutDimensions.accent.thin);

export function useStripAccent(): number {
  return React.useContext(StripAccentContext);
}

export { STRIP_LABEL };

const StripFlipContext = React.createContext(false);

interface StripCap { height: number; radius: number; capLeft: boolean; capRight: boolean }
const StripCapContext = React.createContext<StripCap | null>(null);

export type StripEdge = 'top' | 'bottom' | 'inline';

function dividerStyle(color?: string, flipped?: boolean, accentH: number = D.accent.thick): React.CSSProperties {
  return {
    position: 'absolute', right: 0, zIndex: 2,
    top: flipped ? accentH : 0, bottom: flipped ? 0 : accentH,
    width: Borders.standard.width, background: color ?? `rgba(255,255,255,${O.ghost})`,
  };
}

/** Unified strip container — flush to edges (no bleeding in flat mode).
 *  edge='top' (default) → top alignment.
 *  edge='bottom' → bottom alignment, accent flipped to top.
 *  edge='inline' → inline alignment. */
export function Strip({ edge = 'top', columns, fill, children, style, accent }: {
  edge?: StripEdge; columns?: string; fill?: boolean;
  children: React.ReactNode; style?: React.CSSProperties; accent?: number;
}) {
  const flipped = edge === 'bottom';
  const arr = React.Children.toArray(children);
  const count = arr.length;
  const cols = columns ?? (fill ? `repeat(${count}, 1fr)` : `repeat(${count}, auto)`);
  const h = accent ?? LayoutDimensions.accent.thin;
  const r = LayoutDimensions.radius.cutout;
  const bleedsLeft = true;
  const bleedsRight = !!(columns || fill);
  const capped = arr.map((child, i) => (
    <StripCapContext.Provider key={`cap-${i}`} value={{
      height: h, radius: r,
      capLeft: i === 0 && !bleedsLeft,
      capRight: i === count - 1 && !bleedsRight,
    }}>
      {child}
    </StripCapContext.Provider>
  ));
  let inner = (
    <StripFlipContext.Provider value={flipped}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'stretch', ...(!columns && !fill && { justifyContent: 'start' }), ...style }}>
        {capped}
      </div>
    </StripFlipContext.Provider>
  );
  if (accent != null) inner = <StripAccentContext.Provider value={accent}>{inner}</StripAccentContext.Provider>;
  return inner;
}

/** Single cell — bg tint + right divider (except last) */
export function TabStripCell({ color, isLast, padding, opacity, children, onClick, style, dividerColor, accent }: {
  color: string; isLast?: boolean; padding?: string; opacity?: number;
  children: React.ReactNode; onClick?: () => void; style?: React.CSSProperties;
  dividerColor?: string; accent?: number;
}) {
  const flipped = React.useContext(StripFlipContext);
  const ctxAccent = React.useContext(StripAccentContext);
  const h = accent ?? ctxAccent;
  return (
    <div onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: D.spacing.hairlineGap,
      padding: padding ?? DC.cellPad, minWidth: 0,
      position: 'relative', background: hexToRgba(color, opacity ?? O.ghost),
      ...style,
    }}>
      {children}
      {!isLast && <div style={dividerStyle(dividerColor, flipped, h)} />}
    </div>
  );
}

/** Clickable horizontal enable line — absolutely positioned flush at cell edge.
 *  Rounded caps come from Strip's edgeClip wrappers (overflow:hidden + borderRadius). */
export function EnableLine({ enabled, color, onClick, accent, style: extra }: {
  enabled: boolean; color: string; onClick?: (v: boolean) => void; accent?: number;
  style?: React.CSSProperties;
}) {
  const flipped = React.useContext(StripFlipContext);
  const ctxAccent = React.useContext(StripAccentContext);
  const h = accent ?? ctxAccent;
  const bg = enabled ? color : hexToRgba(color, O.faint);
  const shadow = enabled && h >= D.accent.thick ? S.glow(hexToRgba(color, O.medium), O.full) : 'none';
  const edge = flipped ? { top: 0 } : { bottom: 0 };
  return (
    <div onClick={e => { e.stopPropagation(); onClick?.(!enabled); }} style={{
      position: 'absolute', left: 0, right: 0, ...edge, height: h,
      cursor: onClick ? 'pointer' : 'default', transition: TransitionKeys.normal, background: bg, boxShadow: shadow,
      ...extra,
    }} />
  );
}

/** CSS border accent line on a cell — the ONE pattern for enable-line visuals with rounded ends.
 *  `flipped` puts the line at the top edge instead of bottom. */
export function accentEdgeStyle(h: number, color: string, isFirst?: boolean, isLast?: boolean, flipped?: boolean, r = h): React.CSSProperties {
  const vert = flipped ? 'Top' : 'Bottom';
  return {
    [`border${vert}`]: `${h}px solid ${color}`,
    ...(isFirst && { borderLeft: `${h}px solid ${color}`, [`border${vert}LeftRadius`]: r }),
    ...(isLast && { borderRight: `${h}px solid ${color}`, [`border${vert}RightRadius`]: r }),
    transition: TransitionKeys.normal,
  };
}

// =====================================================
// COMPOUND STRIP PRIMITIVES — shared across all strips
// =====================================================

/** Cell with enable-line indicator + text color from accent.
 *  Edge caps (rounded accent ends) auto-applied from StripCapContext. */
export function EnabledCell({ enabled, color, isLast, align, accent, capLeft, capRight, onClick, style: extraStyle, children }: {
  enabled: boolean; color: string; isLast?: boolean;
  align?: 'left' | 'right'; accent?: number;
  capLeft?: boolean; capRight?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties; children: React.ReactNode;
}) {
  const ctxAccent = React.useContext(StripAccentContext);
  const flipped = React.useContext(StripFlipContext);
  const cap = React.useContext(StripCapContext);
  const h = accent ?? ctxAccent;
  const justify = align === 'left' ? 'flex-end' : align === 'right' ? 'flex-start' : 'center';
  const lineBg = enabled ? color : hexToRgba(color, O.faint);
  const needsLeftCap = capLeft ?? cap?.capLeft ?? false;
  const needsRightCap = capRight ?? cap?.capRight ?? false;
  return (
    <TabStripCell color={color} isLast={isLast} padding={DC.cellPad} opacity={enabled ? O.faint : 0} onClick={onClick}
      style={{ ...accentEdgeStyle(h, lineBg, needsLeftCap, needsRightCap, flipped, cap?.radius ?? h), cursor: onClick ? 'pointer' : 'default', ...extraStyle }} accent={h}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: justify, flex: 1, color }}>{children}</div>
    </TabStripCell>
  );
}

export interface ModuleTab<Id extends string> { id: Id; label: string; content: React.ReactNode; authored: boolean }

/** Siblings share a module's room: one is open, and a dim tab has nothing set inside it. */
export function ModuleTabs<Id extends string>({ tabs, value, onChange, ariaLabel }: { tabs: ModuleTab<Id>[]; value: Id; onChange: (id: Id) => void; ariaLabel: string }) {
  const { primaryColor } = useStyle().getEffectiveStyle();
  return (
    <div role="tablist" aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'stretch', flex: 'none' }}>
      <Strip edge="inline">
        {tabs.map((tab, index) => (
          <EnabledCell key={tab.id} enabled={tab.id === value} color={primaryColor} isLast={index === tabs.length - 1} onClick={() => onChange(tab.id)} style={{ justifyContent: 'center' }}>
            <span role="tab" tabIndex={0} aria-selected={tab.id === value} aria-label={tab.label} title={tab.label} data-tab={tab.id} data-tab-set={tab.authored}
              onKeyDown={event => { if (event.key === 'Enter') onChange(tab.id); }}
              style={{ display: 'grid', placeItems: 'center', minWidth: D.moduleGrid.tabMinWidth, minHeight: D.moduleGrid.tabMinHeight, outline: 'none', opacity: tab.authored ? O.full : O.low }}>{tab.content}</span>
          </EnabledCell>
        ))}
      </Strip>
    </div>
  );
}

// Base style for the spanning aside column
const ASIDE_BASE: React.CSSProperties = { gridRow: '1 / 3', display: 'flex', alignItems: 'center' };

/** 2-column alignment grid: aside control spans both rows, children fill content rows.
 *  align='left' (default) → content left, aside right.
 *  align='right' → aside left, content right. */
export function AlignedGrid({ align, aside, children, style: extra }: {
  align?: 'left' | 'right'; aside: React.ReactNode;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  const pickerRight = align !== 'right';
  const cols = pickerRight ? '1fr auto' : 'auto 1fr';
  const asideStyle = { ...ASIDE_BASE, gridColumn: pickerRight ? 2 : 1 };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gridTemplateRows: 'auto auto',
      gap: `${DC.itemGap}px ${DC.sectionGap}px`, alignItems: 'center', ...extra }}>
      <div style={asideStyle}>{aside}</div>
      {children}
    </div>
  );
}

/** 2-row labeled control — composes on AlignedGrid.
 *  align='left' (default) → text left, control right.
 *  align='right' → text right-aligned, control left. */
export function LabeledControl({ label, value, color, opacity, align, children }: {
  label: string; value?: string; color?: string; opacity?: number;
  align?: 'left' | 'right'; children: React.ReactNode;
}) {
  const textAlign = align === 'right' ? ('right' as const) : undefined;
  return (
    <AlignedGrid align={align} aside={children}>
      <span style={{ ...SYNTH_LABEL, color, textTransform: 'uppercase', textAlign }}>{label}</span>
      {value && <span style={{ ...SYNTH_LABEL, color, opacity: opacity ?? O.inactive, textAlign }}>{value}</span>}
    </AlignedGrid>
  );
}
