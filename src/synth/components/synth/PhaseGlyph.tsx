import React from 'react';
import {useStyle} from '../../StyleContext.tsx';
import {hexToRgba} from '../../../color.ts';
import type {PhaseGlyphValue} from '../../../fields.ts';

// The timeline's own silhouette: a ramp in for entrance, a block for maintain. Every corner is rounded.
const RAMP_PATH = 'M4.17 8L7.1 8A.9 .9 0 0 0 8 7.1L8 4.17A.9 .9 0 0 0 6.465 3.535L3.535 6.465A.9 .9 0 0 0 4.17 8Z';
const BLOCK = {x: 12, y: 2, size: 6, radius: 1.2};
const UNLIT_OPACITY = 0.45;
const INHERITED_OPACITY = 0.5;
const VIEW_WIDTH = 20, VIEW_HEIGHT = 10;

export type {PhaseGlyphValue};
/** What the glyph's fill says of the mode it sits beside: filled when set, half when inherited, outlined when not. */
export const PhaseGlyphMode = {SET: 'set', INHERITED: 'inherited', UNSET: 'unset'} as const;
export type PhaseGlyphModeValue = typeof PhaseGlyphMode[keyof typeof PhaseGlyphMode];
export interface PhaseGlyphProps {
  value: PhaseGlyphValue;
  onChange?: (value: PhaseGlyphValue) => void;
  ariaLabel: string;
  /** Drawn height. The width follows from it. */
  height?: number;
  /** Defaults to SET, the fill the value alone gives. */
  mode?: PhaseGlyphModeValue;
}

export function PhaseGlyph(
  {value, onChange, ariaLabel, height = VIEW_HEIGHT, mode = PhaseGlyphMode.SET}: PhaseGlyphProps,
) {
  const color = useStyle().getEffectiveStyle().primaryColor;
  const paint = (cell: boolean) => (cell && mode !== PhaseGlyphMode.UNSET
    ? {fill: color, stroke: 'none', ...(mode === PhaseGlyphMode.INHERITED && {fillOpacity: INHERITED_OPACITY})}
    : {fill: 'none', stroke: hexToRgba(color, UNLIT_OPACITY), strokeWidth: 1, strokeLinejoin: 'round' as const});
  // One cell always stays lit: no phase at all is the module's switch, not the glyph.
  const toggle = (cell: keyof PhaseGlyphValue) => {
    const next = {...value, [cell]: !value[cell]};
    if (next.entrance || next.maintain) onChange?.(next);
  };
  const interactive = onChange ? {cursor: 'pointer', transition: 'fill .17s ease'} : undefined;
  return (
    <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} width={height * VIEW_WIDTH / VIEW_HEIGHT} height={height} role="group" aria-label={ariaLabel} style={{overflow: 'visible', flex: 'none'}}>
      <g role="switch" aria-label="Entrance" aria-checked={value.entrance} onClick={() => toggle('entrance')} style={interactive}>
        <rect x={0} y={0} width={10} height={VIEW_HEIGHT} fill="transparent"/>
        <path d={RAMP_PATH} {...paint(value.entrance)}/>
      </g>
      <g role="switch" aria-label="Maintain" aria-checked={value.maintain} onClick={() => toggle('maintain')} style={interactive}>
        <rect x={10} y={0} width={10} height={VIEW_HEIGHT} fill="transparent"/>
        <rect x={BLOCK.x} y={BLOCK.y} width={BLOCK.size} height={BLOCK.size} rx={BLOCK.radius} {...paint(value.maintain)}/>
      </g>
    </svg>
  );
}
