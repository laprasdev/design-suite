import React from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { LayoutAPI, D, DC, F, O, Borders, STRIP_LABEL } from '../../design/index.ts';
import { hexToRgba } from '../../../color.ts';

// =====================================================
// LAYOUT COMPONENTS
// Replaces: Window, Module, ModuleRow, ModuleCardBackground, ModuleCardCutout
// All containers now respect advancedSettings.moduleDisplayMode
// =====================================================

// =====================================================
// WINDOW - Top-level page container
// =====================================================
export interface WindowProps {
  children: React.ReactNode;
  className?: string;
  singleColumn?: boolean;
}

export function Window({ children, className = '', singleColumn = false }: WindowProps) {
  return (
    <div className={className} style={LayoutAPI.windowContainer()}>
      <div style={{
        display: F.grid,
        gap: D.spacing.sectionGap,
        gridTemplateColumns: singleColumn ? '1fr' : `repeat(${D.grid.moduleColumns}, 1fr)`
      }}>
        {children}
      </div>
    </div>
  );
}

// =====================================================
// MODULE CARD BACKGROUND - Container with gradient + shadow
// Now respects moduleDisplayMode setting
// =====================================================
export interface ModuleCardBackgroundProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function ModuleCardBackground({ children, className = '', style: customStyle }: ModuleCardBackgroundProps) {
  const { getEffectiveStyle, advancedSettings } = useStyle();
  const theme = getEffectiveStyle();
  const displayMode = advancedSettings.moduleDisplayMode;

  return (
    <div
      className={className}
      style={{
        ...LayoutAPI.getModuleContainer(theme, displayMode),
        ...customStyle
      }}
    >
      {children}
    </div>
  );
}

// =====================================================
// MODULE CARD CUTOUT - Inset container for controls
// Now respects moduleDisplayMode setting
// =====================================================
export interface ModuleCardCutoutProps {
  children: React.ReactNode;
  className?: string;
  width?: string;
  style?: React.CSSProperties;
  title?: string;
  headerControls?: React.ReactNode;
  showTitle?: boolean;
}

const CARD_COLUMN: React.CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' };
const CARD_BODY: React.CSSProperties = { ...CARD_COLUMN, flex: 1, overflow: 'auto' };
function ModuleCardHeader({ title, controls, showTitle }: { title?: string; controls?: React.ReactNode; showTitle: boolean }) {
  const theme = useStyle().getEffectiveStyle();
  const HEADER_ROW: React.CSSProperties = {
    display: 'flex', alignItems: 'stretch', flexShrink: 0,
    minHeight: D.cellSize.small, gap: showTitle ? DC.itemGap : 0,
  };
  return <header aria-label={title} data-module-header={title} style={{ ...HEADER_ROW, borderBottom: `${Borders.standard.width}px solid ${hexToRgba(theme.accentColor, O.low)}` }}>
    {showTitle && title && <h2 style={{ ...STRIP_LABEL, color: theme.primaryColor, textTransform: 'uppercase', cursor: 'default', margin: 0, padding: DC.cellPad, alignSelf: 'center', flexShrink: 0 }}>{title}</h2>}
    {controls && <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', flex: 1, minWidth: 0 }}
      onMouseDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>{controls}</div>}
  </header>;
}

export function ModuleCardCutout({ children, className = '', width, style: customStyle, title, headerControls, showTitle = true }: ModuleCardCutoutProps) {
  const { getEffectiveStyle, advancedSettings } = useStyle();
  const style = { ...LayoutAPI.getCutoutContainer(getEffectiveStyle(), advancedSettings.moduleDisplayMode), width, ...customStyle };
  const framed = Boolean(title || headerControls), header = Boolean((showTitle && title) || headerControls);
  return <div className={className} data-module-owner={title ?? ""} aria-label={title} style={framed ? { ...style, ...CARD_COLUMN } : style}>
    {header && <ModuleCardHeader title={title} controls={headerControls} showTitle={showTitle} />}
    {framed ? <div data-module-body={title} style={CARD_BODY}>{children}</div> : children}
  </div>;
}

// =====================================================
// MODULE - Complete module with background
// =====================================================
export interface ModuleProps {
  children: React.ReactNode;
  className?: string;
}

export function Module({ children, className = '' }: ModuleProps) {
  return (
    <ModuleCardBackground className={className}>
      <div style={LayoutAPI.flexColumn(D.spacing.rowGap)}>
        {children}
      </div>
    </ModuleCardBackground>
  );
}

// =====================================================
// MODULE ROW - Horizontal row within a module
// =====================================================
export interface ModuleRowProps {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  justify?: string;
  align?: string;
}

export function ModuleRow({ 
  children, 
  className = '',
  gap = D.spacing.itemGap,
  justify = F.start,
  align = F.center
}: ModuleRowProps) {
  return (
    <div className={className} style={LayoutAPI.flexRow(gap, justify, align)}>
      {children}
    </div>
  );
}



