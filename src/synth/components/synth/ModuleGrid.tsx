import React, { useCallback, useContext, useRef, useState } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { hexToRgba } from '../../../color.ts';
import { D, O, T, TransitionKeys } from '../../design/index.ts';
import { Knob, KnobPreset, KnobLabelStyle, KnobLayout, KnobStroke, KnobValueType } from './Knob.tsx';
import { Boolean as BooleanControl, BooleanForm } from './Boolean.tsx';

// A module's body is four equal columns, and every control takes whole cells, so nothing sits between two columns or moves between tabs.
// In the rack it has a fixed size. On a page it fills its tile, and its controls grow with their cells up to a limit.
const G = D.moduleGrid;

const clamp = (value: number, lowest: number, highest: number) => Math.min(highest, Math.max(lowest, value));
const ModuleControlSize = React.createContext<number>(G.controlMin);
/** How big a knob is in this grid's cells. */
export const useModuleControlSize = () => useContext(ModuleControlSize);

function useFilledControlSize(rows: number) {
  const [size, setSize] = useState<number>(G.controlMin);
  const observer = useRef<ResizeObserver | null>(null);
  const grid = useCallback((element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!element) return;
    const measure = () => {
      const width = (element.clientWidth - G.fillPadding * 2 - G.fillGap * (G.columns - 1)) / G.columns;
      const height = (element.clientHeight - G.fillPadding * 2 - G.fillGap * (rows - 1)) / rows - G.fieldTextRoom;
      setSize(clamp(Math.round(Math.min(width, height) * G.controlShare), G.controlMin, G.controlMax));
    };
    observer.current = new ResizeObserver(measure);
    observer.current.observe(element);
    measure();
  }, [rows]);
  return { grid, size };
}

/** The rack's fixed grid. */
export function ModuleGrid({ rowsPerKnob = 1, children }: { rowsPerKnob?: 1 | 2; children: React.ReactNode }) {
  return (
    <div data-module-grid style={{ display: 'grid', gridTemplateColumns: `repeat(${G.columns}, ${G.cellWidth}px)`, gridTemplateRows: `repeat(${G.rows * rowsPerKnob}, ${G.rowHeight / rowsPerKnob}px)`, padding: `${G.ringHeadroom}px ${G.sidePadding}px ${G.footPadding}px`, alignItems: 'start', justifyItems: 'center', lineHeight: G.tightLine }}>
      {children}
    </div>
  );
}

/** A page's grid: the same four columns, stretched to whatever its tile gives it. `sizingRows` is the most rows any of the module's tabs has, so controls keep their size across tabs. Too small a tile scrolls this body under its header. */
export function FilledModuleGrid({ rows, sizingRows = rows, children }: { rows: number; sizingRows?: number; children: React.ReactNode }) {
  const { grid, size } = useFilledControlSize(sizingRows);
  return (
    <div ref={grid} data-module-grid data-grid-rows={rows} data-control-size={size} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: `repeat(${G.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(min-content, 1fr))`, gap: G.fillGap, padding: G.fillPadding, lineHeight: G.tightLine }}>
      <ModuleControlSize.Provider value={size}>{children}</ModuleControlSize.Provider>
    </div>
  );
}

export function ModuleCell({ column, row, columns = 1, rows = 1, stretch, children }: { column: number; row: number; columns?: number; rows?: number; stretch?: boolean; children: React.ReactNode }) {
  return <div data-grid-cell={`${column},${row}`} style={{ gridColumn: `${column} / span ${columns}`, gridRow: `${row} / span ${rows}`, minWidth: 0, ...(stretch && { justifySelf: 'stretch', alignSelf: 'stretch' }) }}>{children}</div>;
}

/** Recolours an icon's own file by the text colour around it. */
export function Icon({ svg, height = G.iconHeight, flip, label }: { svg: string; height?: number; flip?: boolean; label?: string }) {
  const sized = svg.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg ', `<svg height="${height}" style="display:block;${flip ? 'transform:scaleX(-1)' : ''}" `).replace(/#fff/g, 'currentColor');
  return <span role={label ? 'img' : undefined} aria-label={label} style={{ display: 'inline-block', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: sized }} />;
}

/** The header's one layout: which group is open on the left, then its tabs and any switch on the right. */
export function ModuleHeaderRow({ group, children }: { group?: string; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', gap: G.headerGap, flex: 1, minWidth: 0 }}>
      {group && <span data-open-group style={{ ...T.moduleLabel, alignSelf: 'center', marginRight: 'auto', textTransform: 'uppercase', color: style.textColor, opacity: O.high, whiteSpace: 'nowrap' }}>{group}</span>}
      {children}
    </div>
  );
}

/** A module on a page: its name, its open group and its tabs over a body that fills the tile. The tile draws the only border. */
export function GridModule({ title, group, tabs, children }: { title: string; group?: string; tabs?: React.ReactNode; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  return (
    <section data-grid-module data-module-owner={title} aria-label={title} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <header data-module-header={title} style={{ flexShrink: 0, display: 'flex', alignItems: 'stretch', gap: G.headerTitleGap, paddingLeft: G.headerInset }}>
        <h2 style={{ ...T.title, margin: 0, alignSelf: 'center', color: style.primaryColor, textTransform: 'uppercase', cursor: 'default' }}>{title}</h2>
        <ModuleHeaderRow group={group}>{tabs}</ModuleHeaderRow>
      </header>
      <div data-module-body={title} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>{children}</div>
    </section>
  );
}

// How much a field says for itself: set, quiet because nothing is set or it inherits, or inert because it can't apply here.
export const FieldEmphasis = Object.freeze({ SET: 'set', QUIET: 'quiet', INERT: 'inert' } as const);
export type FieldEmphasisValue = typeof FieldEmphasis[keyof typeof FieldEmphasis];
const CONTROL_OPACITY: Record<FieldEmphasisValue, number> = { set: O.full, quiet: O.medium, inert: O.low };

/** A field in its cell: the control, what it reads, and its name, all staying readable when dim. Pressing the name is optional. */
export function ModuleField({ label, value, emphasis, onName, nameLabel, nameTitle, stretch, children }: { label: string; value?: React.ReactNode; emphasis: FieldEmphasisValue; onName?: () => void; nameLabel?: string; nameTitle?: string; stretch?: boolean; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  const nameStyle: React.CSSProperties = { ...T.moduleLabel, textTransform: 'uppercase', textAlign: 'center', color: set ? style.primaryColor : hexToRgba(style.textColor, O.high), transition: TransitionKeys.fast };
  return (
    <div data-module-field={label} data-field-emphasis={emphasis} aria-disabled={inert} style={{ display: 'grid', justifyItems: 'center', gap: G.fieldGap, width: stretch ? '100%' : undefined }}>
      <div data-field-control style={{ display: 'grid', placeItems: 'center', width: stretch ? '100%' : undefined, opacity: CONTROL_OPACITY[emphasis], pointerEvents: inert ? 'none' : undefined, transition: TransitionKeys.fast }}>{children}</div>
      {value !== undefined && <div data-field-value style={{ ...T.moduleValue, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: hexToRgba(style.textColor, set ? O.full : O.high) }}>{value}</div>}
      {onName && !inert
        ? <button type="button" data-field-name aria-label={nameLabel} title={nameTitle} onClick={onName} style={{ ...nameStyle, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>{label}</button>
        : <span data-field-name style={nameStyle}>{label}</span>}
    </div>
  );
}

/** The minimal knob, its value and name left to the field around it. */
export function ModuleKnob({ value, min, max, integer, onChange, ariaLabel, disabled }: { value: number; min: number; max: number; integer: boolean; onChange: (value: number) => void; ariaLabel: string; disabled?: boolean }) {
  const size = useModuleControlSize();
  const config = { ...KnobPreset.minimal, size, stroke: KnobStroke.STANDARD, labelStyle: KnobLabelStyle.PLAIN, layout: KnobLayout.KNOB_ONLY, valueType: integer ? KnobValueType.INTEGER : KnobValueType.FLOAT };
  return <div role="group" aria-label={ariaLabel}><Knob config={config} tooltip={ariaLabel} sensitivity={(max - min) / G.knobDragPx} value={value} min={min} max={max} disabled={disabled} disabledOpacity={O.full} onChange={onChange} color="primary" /></div>;
}

/** The switch form at the size of this grid's controls. */
export function ModuleSwitch({ value, onChange, ariaLabel, disabled }: { value: boolean; onChange: (value: boolean) => void; ariaLabel: string; disabled?: boolean }) {
  const height = clamp(Math.round(useModuleControlSize() * G.switchShare), G.switchMin, G.switchMax);
  return <BooleanControl form={BooleanForm.SWITCH} height={height} value={value} onChange={onChange} ariaLabel={ariaLabel} disabled={disabled} />;
}
