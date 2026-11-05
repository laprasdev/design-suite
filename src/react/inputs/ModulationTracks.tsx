import React from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {LayoutDimensions} from '../../layout.ts';
import {MODULATOR_LIVE_COLOR, RangeEnd, modulationLadder, modulatorColor, modulatorOpacity,
  type ModulationProps} from '../../synth/components/synth/modulation.ts';

const HIT_HEIGHT = 7, LIVE_SCALE = 2.4, CHEVRON_HEIGHT = 6, CHEVRON_WIDTH = 3, NUMERAL_OFFSET = 8, GLOW = 3;
const NUMERAL_SIZE = LayoutDimensions.moduleGrid.ringNumeralSize;
export const modulationTrackHeight = (count: number, thickness: number) => {
  const {line, gap} = modulationLadder(thickness);
  return count * (gap + line);
};
function Chevron({at, pointsUp, color, width}: {at: number; pointsUp: boolean; color: string; width: number}) {
  const tip = pointsUp ? CHEVRON_WIDTH : -CHEVRON_WIDTH;
  return <svg width={CHEVRON_WIDTH * 2} height={CHEVRON_HEIGHT + width} aria-hidden
    style={{position: 'absolute', left: `${at}%`, top: '50%', transform: 'translate(-50%, -50%)',
      overflow: 'visible', pointerEvents: 'none'}}>
    <path d={`M${CHEVRON_WIDTH} ${width / 2}L${CHEVRON_WIDTH + tip} ${(CHEVRON_HEIGHT + width) / 2}`+
      `L${CHEVRON_WIDTH} ${CHEVRON_HEIGHT + width / 2}`} fill="none" stroke={color} strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
interface Props extends ModulationProps {
  low: number; high: number; min: number; max: number; thickness: number; bottom: number;
}
/** The same source lines on cell, setting and range sliders. Selecting a source never starts a value drag. */
export function ModulationTracks({modulators = [], selectedSource, onSelectSource,
  low, high, min, max, thickness, bottom}: Props) {
  const style = useStyle().getEffectiveStyle(), {line, gap} = modulationLadder(thickness);
  const percent = (value: number) => Math.min(1, Math.max(0, (value - min) / (max - min))) * 100;
  return <>{modulators.map((modulator, index) => {
    const end = modulator.end ?? RangeEnd.END, base = end === RangeEnd.ORIGIN ? low : high;
    const color = modulatorColor(modulator.root, style);
    const from = percent(base - (modulator.bipolar ? Math.abs(modulator.depth) : Math.max(0, -modulator.depth)));
    const to = percent(base + (modulator.bipolar ? Math.abs(modulator.depth) : Math.max(0, modulator.depth)));
    const y = bottom + thickness + gap + line / 2 + index * (line + gap);
    const live = modulator.sample === undefined ? undefined : percent(base + modulator.sample * modulator.depth);
    const tipUp = modulator.depth >= 0 || modulator.bipolar;
    const tips = modulator.bipolar ? [{at: from, up: false}, {at: to, up: true}]
      : [{at: tipUp ? to : from, up: !!tipUp}];
    return <div key={`${modulator.source}${end}`} data-modulator={modulator.source}
      onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()}
      onClick={event => {event.stopPropagation(); onSelectSource?.(modulator.source);}}
      style={{position: 'absolute', left: 0, right: 0, bottom: y - HIT_HEIGHT / 2, height: HIT_HEIGHT,
        opacity: modulatorOpacity(modulator.source, selectedSource),
        transition: 'opacity .17s ease', pointerEvents: 'none'}}>
      <div role="button" aria-label={`Modulation source ${index + 1}`} tabIndex={onSelectSource ? 0 : -1}
        onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation(); onSelectSource?.(modulator.source);
        }}}
        style={{position: 'absolute', left: `${from}%`, width: `${to - from}%`, top: '50%', height: line,
          transform: 'translateY(-50%)', borderRadius: line, background: color,
          boxShadow: `0 0 ${GLOW}px ${color}`, pointerEvents: 'auto', cursor: 'pointer'}}/>
      {tips.map(tip => <Chevron key={String(tip.up)} at={tip.at} pointsUp={tip.up} color={color} width={line}/>)}
      {live !== undefined && <div style={{position: 'absolute', left: `${live}%`, top: '50%',
        width: line * LIVE_SCALE, height: line * LIVE_SCALE, transform: 'translate(-50%, -50%)',
        borderRadius: '50%', background: MODULATOR_LIVE_COLOR,
        boxShadow: `0 0 ${GLOW}px ${MODULATOR_LIVE_COLOR}`, pointerEvents: 'none'}}/>}
      <span style={{position: 'absolute',
        left: `calc(${tips.at(-1)!.at}% + ${tips.at(-1)!.up ? NUMERAL_OFFSET : -NUMERAL_OFFSET}px)`,
        top: '50%', transform: 'translate(-50%, -50%)', fontSize: NUMERAL_SIZE, fontWeight: 700,
        lineHeight: 1, color, pointerEvents: 'none'}}>{index + 1}</span>
    </div>;
  })}</>;
}
