import React from 'react';
import {useStyle} from '../../synth/StyleContext.tsx';
import {LayoutDimensions} from '../../layout.ts';
import {MODULATOR_FADE, MODULATOR_GLOW, MODULATOR_LIVE_COLOR, modulationLadder, modulatorColor, modulatorOpacity}
  from '../../synth/components/synth/modulation.ts';
import {ReachDirection, blendedReach} from './modulationBlend.ts';
import {LIVE_SCALE, ModulationPart, sourcePart} from './modulationParts.ts';
import type {ModulationTrackProps} from './modulationTrackProps.ts';

const HIT_HEIGHT = 7, CHEVRON_HEIGHT = 6, CHEVRON_WIDTH = 3, NUMERAL_OFFSET = 8;
const NUMERAL_SIZE = LayoutDimensions.moduleGrid.ringNumeralSize;

/** The height a box adds above its track to hold `count` lines. */
export const sourceLinesRoom = (count: number, thickness: number) => {
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

/** One line a source above the track, each with an arrow tip at every end it reaches and its numeral. The spans and
 *  end points are the blended model's, so both forms read the same reach. */
export function SourceLines({modulators = [], selectedSource, onSelectSource, low, high, min, max, thickness, bottom,
  thumb = 0}: ModulationTrackProps) {
  const style = useStyle().getEffectiveStyle(), {line, gap} = modulationLadder(thickness);
  const {reaches} = blendedReach(modulators, low, high, min, max);
  // The ladder starts above the track, or above the thumb where that stands taller.
  const clear = Math.max(thickness, (thickness + thumb) / 2);
  return <>{modulators.map((modulator, index) => {
    const own = reaches.filter(reach => reach.source === index);
    const from = Math.min(...own.map(reach => reach.from)), to = Math.max(...own.map(reach => reach.to));
    const tips = own.map(reach => reach.direction === ReachDirection.UP
      ? {at: reach.to, up: true} : {at: reach.from, up: false});
    const last = tips[tips.length - 1], live = own[0].live;
    const color = modulatorColor(modulator.root, style);
    const y = bottom + clear + gap + line / 2 + index * (line + gap);
    const part = sourcePart(onSelectSource, modulator.source, `Modulation source ${index + 1}`);
    const identity = {[ModulationPart.SOURCE]: modulator.source, [ModulationPart.LINE]: ''};
    return <div key={`${modulator.source}${modulator.end}`} {...identity}
      style={{position: 'absolute', left: 0, right: 0, bottom: y - HIT_HEIGHT / 2, height: HIT_HEIGHT,
        opacity: modulatorOpacity(modulator.source, selectedSource),
        transition: MODULATOR_FADE, pointerEvents: 'none'}}>
      <div {...part.attributes} style={{...part.style, position: 'absolute', left: `${from}%`,
        width: `${to - from}%`, top: '50%', height: line, transform: 'translateY(-50%)', borderRadius: line,
        background: color, boxShadow: `0 0 ${MODULATOR_GLOW}px ${color}`}}/>
      {tips.map(tip => <Chevron key={String(tip.up)} at={tip.at} pointsUp={tip.up} color={color} width={line}/>)}
      {live !== undefined && <div {...{[ModulationPart.LIVE]: modulator.source}}
        style={{position: 'absolute', left: `${live}%`, top: '50%',
        width: line * LIVE_SCALE, height: line * LIVE_SCALE, transform: 'translate(-50%, -50%)',
        borderRadius: '50%', background: MODULATOR_LIVE_COLOR,
        boxShadow: `0 0 ${MODULATOR_GLOW}px ${MODULATOR_LIVE_COLOR}`, pointerEvents: 'none'}}/>}
      <span {...{[ModulationPart.NUMERAL]: ''}} aria-hidden style={{position: 'absolute',
        left: `calc(${last.at}% + ${last.up ? NUMERAL_OFFSET : -NUMERAL_OFFSET}px)`,
        top: '50%', transform: 'translate(-50%, -50%)', fontSize: NUMERAL_SIZE, fontWeight: 700,
        lineHeight: 1, color, pointerEvents: 'none'}}>{index + 1}</span>
    </div>;
  })}</>;
}
