import React, { useCallback, useContext, useRef, useState } from 'react';
import { useStyle } from '../../StyleContext.tsx';
import { hexToRgba } from '../../../color.ts';
import { D, O, T, TransitionKeys } from '../../design/index.ts';
import { Knob, KnobPreset, KnobLabelStyle, KnobLayout, KnobStroke, KnobValueType } from './Knob.tsx';
import { Boolean as BooleanControl, BooleanForm } from './Boolean.tsx';
import type { ModulationProps } from './modulation.ts';

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
  const sized = svg.replace(/\s(width|height)="[^"]*"/g, '').replace('<svg ', `<svg height="${height}" style="display:block;${flip ? 'transform:scaleX(-1)' : ''}" `).replace(/#fff|\bwhite\b/g, 'currentColor');
  return <span role={label ? 'img' : undefined} aria-label={label} style={{ display: 'inline-block', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: sized }} />;
}

/** The header's one layout: which group is open on the left, then its tabs and any switch on the right. */
export function ModuleHeaderRow({ group, children }: { group?: string; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'flex-end', gap: G.headerGap, flex: 1, minWidth: 0 }}>
      {group && <span data-open-group style={{ ...T.moduleLabel, alignSelf: 'flex-start', lineHeight: `${G.headerLineHeight}px`, marginRight: 'auto', textTransform: 'uppercase', color: style.textColor, opacity: O.high, whiteSpace: 'nowrap' }}>{group}</span>}
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
        <h2 style={{ ...T.title, margin: 0, alignSelf: 'flex-start', lineHeight: `${G.headerLineHeight}px`, color: style.primaryColor, textTransform: 'uppercase', cursor: 'default' }}>{title}</h2>
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

function FieldName({ label, icon, emphasis, onName, nameLabel, nameTitle }: { label: string; icon?: React.ReactNode; emphasis: FieldEmphasisValue; onName?: () => void; nameLabel?: string; nameTitle?: string }) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  const nameStyle: React.CSSProperties = { ...T.moduleLabel, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: G.nameIconGap, textTransform: 'uppercase', textAlign: 'center', color: set ? style.primaryColor : hexToRgba(style.textColor, O.high), transition: TransitionKeys.fast };
  const content = <>{icon}{label}</>;
  return onName && !inert
    ? <button type="button" data-field-name aria-label={nameLabel} title={nameTitle} onClick={onName} style={{ ...nameStyle, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}>{content}</button>
    : <span data-field-name style={nameStyle}>{content}</span>;
}

/** A field in its cell: the control, what it reads, and its name, all staying readable when dim. Pressing the name is optional. */
export function ModuleField({ label, icon, value, emphasis, onName, nameLabel, nameTitle, stretch, children }: { label: string; icon?: React.ReactNode; value?: React.ReactNode; emphasis: FieldEmphasisValue; onName?: () => void; nameLabel?: string; nameTitle?: string; stretch?: boolean; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  return (
    <div data-module-field={label} data-field-emphasis={emphasis} aria-disabled={inert} style={{ display: 'grid', justifyItems: 'center', gap: G.fieldGap, width: stretch ? '100%' : undefined }}>
      <div data-field-control style={{ display: 'grid', placeItems: 'center', width: stretch ? '100%' : undefined, opacity: CONTROL_OPACITY[emphasis], pointerEvents: inert ? 'none' : undefined, transition: TransitionKeys.fast }}>{children}</div>
      {value !== undefined && <div data-field-value style={{ ...T.moduleValue, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: hexToRgba(style.textColor, set ? O.full : O.high) }}>{value}</div>}
      <FieldName label={label} icon={icon} emphasis={emphasis} onName={onName} nameLabel={nameLabel} nameTitle={nameTitle} />
    </div>
  );
}

/** A field as a row across its cells: its name, the control, and what it reads. For a range, whose control wants the width. */
export function ModuleFieldRow({ label, icon, value, emphasis, onName, nameLabel, nameTitle, children }: { label: string; icon?: React.ReactNode; value?: React.ReactNode; emphasis: FieldEmphasisValue; onName?: () => void; nameLabel?: string; nameTitle?: string; children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  const set = emphasis === FieldEmphasis.SET, inert = emphasis === FieldEmphasis.INERT;
  return (
    <div data-module-field={label} data-field-emphasis={emphasis} aria-disabled={inert} style={{ display: 'grid', gridTemplateColumns: `minmax(${G.rowLabelWidth}px, max-content) minmax(0, 1fr) minmax(${G.rowValueWidth}px, max-content)`, alignItems: 'center', gap: G.rowGap, width: '100%' }}>
      <div style={{ justifySelf: 'start' }}><FieldName label={label} icon={icon} emphasis={emphasis} onName={onName} nameLabel={nameLabel} nameTitle={nameTitle} /></div>
      <div data-field-control style={{ display: 'flex', minWidth: 0, opacity: CONTROL_OPACITY[emphasis], pointerEvents: inert ? 'none' : undefined, transition: TransitionKeys.fast }}>{children}</div>
      <div data-field-value style={{ ...T.moduleValue, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: hexToRgba(style.textColor, set ? O.full : O.high) }}>{value}</div>
    </div>
  );
}

/** A sentence in a module saying what it can't do yet, or what limit applies. */
export function ModuleNotice({ children }: { children: React.ReactNode }) {
  const style = useStyle().getEffectiveStyle();
  return <p data-module-notice style={{ ...T.moduleValue, margin: 0, flexShrink: 0, padding: `0 ${G.noticePadding}px ${G.noticePadding}px`, color: hexToRgba(style.textColor, O.high) }}>{children}</p>;
}

/** A module's own header controls in a row, between its tabs and the tile's edge. */
export function ModuleHeaderControls({ children }: { children: React.ReactNode }) {
  return <div data-module-header-controls style={{ display: 'flex', alignItems: 'center', gap: G.headerGap, padding: `0 ${G.headerControlsPadding}px`, flex: 'none' }}>{children}</div>;
}

/** The minimal knob, its value and name left to the field around it. */
export function ModuleKnob({ value, min, max, integer, onChange, ariaLabel, disabled, modulators, selectedSource, onSelectSource }: { value: number; min: number; max: number; integer: boolean; onChange: (value: number) => void; ariaLabel: string; disabled?: boolean } & ModulationProps) {
  const size = useModuleControlSize();
  const config = { ...KnobPreset.minimal, size, stroke: KnobStroke.STANDARD, labelStyle: KnobLabelStyle.PLAIN, layout: KnobLayout.KNOB_ONLY, valueType: integer ? KnobValueType.INTEGER : KnobValueType.FLOAT };
  return <div role="group" aria-label={ariaLabel}><Knob config={config} tooltip={ariaLabel} sensitivity={(max - min) / G.knobDragPx} value={value} min={min} max={max} disabled={disabled} disabledOpacity={O.full} onChange={onChange} color="primary" modulators={modulators} selectedSource={selectedSource} onSelectSource={onSelectSource} /></div>;
}

/** The switch form at the size of this grid's controls. */
export function ModuleSwitch({ value, onChange, ariaLabel, disabled }: { value: boolean; onChange: (value: boolean) => void; ariaLabel: string; disabled?: boolean }) {
  const height = clamp(Math.round(useModuleControlSize() * G.switchShare), G.switchMin, G.switchMax);
  return <BooleanControl form={BooleanForm.SWITCH} height={height} value={value} onChange={onChange} ariaLabel={ariaLabel} disabled={disabled} />;
}

/** A compact list on a module's grid, for choices too many to show as options. */
export function ModuleSelect<Value extends string | number>({ value, options, onChange, ariaLabel, disabled }: { value: Value; options: { value: Value; label: string }[]; onChange?: (value: Value) => void; ariaLabel: string; disabled?: boolean }) {
  const style = useStyle().getEffectiveStyle();
  return <select aria-label={ariaLabel} value={String(value)} disabled={disabled || !onChange} onChange={event => { const found = options.find(option => String(option.value) === event.target.value); if (found) onChange?.(found.value); }}
    style={{ ...T.moduleValue, color: style.textColor, background: style.cutoutBackground, border: `1px solid ${hexToRgba(style.primaryColor, O.low)}`, borderRadius: D.radius.button, padding: G.inputPadding, minWidth: 0, maxWidth: '100%' }}>
    {options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
  </select>;
}

/** A typed number. What's being typed stays as typed, and only a real number writes. */
export function ModuleNumberInput({ value, onChange, ariaLabel, disabled, onFocus, onBlur, fill }: { value: number; onChange?: (value: number) => void; ariaLabel: string; disabled?: boolean; onFocus?: () => void; onBlur?: () => void; fill?: boolean }) {
  const style = useStyle().getEffectiveStyle();
  const [typing, setTyping] = useState<string | null>(null);
  return <input type="number" step="any" aria-label={ariaLabel} disabled={disabled} value={typing ?? String(value)}
    onFocus={() => { setTyping(String(value)); onFocus?.(); }} onBlur={() => { setTyping(null); onBlur?.(); }}
    onChange={event => { setTyping(event.target.value); const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange?.(next); }}
    style={{ ...T.moduleValue, width: fill ? '100%' : G.numberInputWidth, minWidth: 0, boxSizing: 'border-box', color: style.textColor, background: style.cutoutBackground, border: `1px solid ${hexToRgba(style.primaryColor, O.low)}`, borderRadius: D.radius.button, padding: G.inputPadding, opacity: disabled ? O.medium : O.full }} />;
}

/** A typed line of text. */
export function ModuleTextInput({ value, onChange, ariaLabel, placeholder, fill, disabled }: { value: string; onChange: (value: string) => void; ariaLabel: string; placeholder?: string; fill?: boolean; disabled?: boolean }) {
  const style = useStyle().getEffectiveStyle();
  return <input type="text" aria-label={ariaLabel} value={value} placeholder={placeholder} disabled={disabled} onChange={event => onChange(event.target.value)}
    style={{ ...T.moduleValue, width: fill ? '100%' : G.numberInputWidth, minWidth: 0, boxSizing: 'border-box', color: style.textColor, background: style.cutoutBackground, border: `1px solid ${hexToRgba(style.primaryColor, O.low)}`, borderRadius: D.radius.button, padding: G.inputPadding }} />;
}

/** An icon and its name that opens something. Dim when this case doesn't use it, and quiet when nothing is set in it, and it still opens either way. */
export function ModuleToolButton({ label, icon, title, dim, set, onPress }: { label: string; icon: React.ReactNode; title?: string; dim?: boolean; set?: boolean; onPress: () => void }) {
  const style = useStyle().getEffectiveStyle();
  return <button type="button" data-module-tool={label} data-tool-used={!dim} data-tool-set={set} title={title} aria-label={label} onClick={onPress} style={{ ...T.moduleLabel, display: 'grid', justifyItems: 'center', gap: G.fieldGap, padding: 0, minWidth: 0, border: 'none', background: 'transparent', cursor: 'pointer', textTransform: 'uppercase', color: set ? style.primaryColor : hexToRgba(style.textColor, O.high), opacity: dim ? O.medium : O.full }}>{icon}<span style={{ overflowWrap: 'anywhere' }}>{label}</span></button>;
}

/** Text chips for the groups inside a tab: the second level, when a tab holds more than one grid can. A dim chip has nothing set inside it. */
export function ModuleGroups<Id extends string>({ groups, value, onChange, ariaLabel }: { groups: { id: Id; label: string; set: boolean }[]; value: Id; onChange: (id: Id) => void; ariaLabel: string }) {
  const style = useStyle().getEffectiveStyle();
  return <div role="tablist" aria-label={ariaLabel} data-module-groups style={{ flexShrink: 0, maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexWrap: 'wrap', gap: G.groupGap, padding: `${G.groupStripPadding}px ${G.headerInset}px 0` }}>
    {groups.map(group => { const open = group.id === value; return <button key={group.id} type="button" role="tab" aria-selected={open} data-group={group.id} data-group-set={group.set} onClick={() => onChange(group.id)}
      style={{ ...T.moduleLabel, padding: `${G.groupPaddingBlock}px ${G.groupPaddingInline}px`, border: 'none', borderRadius: D.radius.button, cursor: 'pointer', textTransform: 'uppercase', background: open ? hexToRgba(style.primaryColor, O.subtle) : 'transparent', color: open || group.set ? style.primaryColor : hexToRgba(style.textColor, O.high) }}>{group.label}</button>; })}
  </div>;
}

/** A curve to read. It draws what the asset holds and takes no edits. */
export function ModuleCurve({ points, ariaLabel }: { points: { x: number; y: number }[] | null; ariaLabel: string }) {
  const style = useStyle().getEffectiveStyle();
  const line = points?.map(point => `${point.x * G.curveWidth},${(1 - point.y) * G.curveHeight}`).join(' ');
  return <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${G.curveWidth} ${G.curveHeight}`} width="100%" height={G.curveHeight} preserveAspectRatio="none" style={{ display: 'block', maxWidth: G.curveWidth, overflow: 'visible' }}>
    <rect x={0} y={0} width={G.curveWidth} height={G.curveHeight} rx={D.radius.button} fill={hexToRgba(style.primaryColor, O.ghost)} />
    {line && <polyline points={line} fill="none" stroke={style.primaryColor} strokeWidth={G.curveLine} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
}

/** A field whose contents open in the module's body. */
export function ModuleOpenButton({ ariaLabel, onPress, disabled }: { ariaLabel: string; onPress: () => void; disabled?: boolean }) {
  const style = useStyle().getEffectiveStyle();
  return <button type="button" data-field-open aria-label={ariaLabel} disabled={disabled} onClick={onPress} style={{ ...T.moduleLabel, width: G.openButtonWidth, height: G.openButtonHeight, padding: 0, border: `1px solid ${hexToRgba(style.primaryColor, O.low)}`, borderRadius: D.radius.button, background: 'transparent', color: style.primaryColor, cursor: disabled ? 'not-allowed' : 'pointer' }}>›</button>;
}

/** A colour to pick. `hex` is what the browser's picker can show, and channels past 1 stay as written until a pick replaces them. */
export function ModuleColorInput({ hex, alpha, onHex, onAlpha, ariaLabel, disabled, onFocus, onBlur }: { hex: string; alpha: number; onHex: (hex: string) => void; onAlpha: (alpha: number) => void; ariaLabel: string; disabled?: boolean; onFocus?: () => void; onBlur?: () => void }) {
  const style = useStyle().getEffectiveStyle();
  return <div data-module-color style={{ display: 'grid', justifyItems: 'center', gap: G.groupGap }}>
    <input type="color" aria-label={ariaLabel} value={hex} disabled={disabled} onFocus={onFocus} onBlur={onBlur} onChange={event => onHex(event.target.value)} style={{ width: G.swatchWidth, height: G.swatchHeight, padding: 0, border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer' }} />
    <label title="Alpha" style={{ ...T.moduleValue, display: 'flex', alignItems: 'center', gap: G.groupGap, color: style.textColor }}>A<ModuleNumberInput ariaLabel={`${ariaLabel} alpha`} value={alpha} disabled={disabled} fill onFocus={onFocus} onBlur={onBlur} onChange={onAlpha} /></label>
  </div>;
}
