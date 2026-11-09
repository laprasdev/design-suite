import React from 'react';
import {LayoutDimensions} from '../../layout.ts';
import {useStyle} from '../../synth/StyleContext.tsx';
import {MODULATOR_FADE, MODULATOR_GLOW, MODULATOR_LIVE_COLOR, modulationLadder, modulatorColor, modulatorOpacity}
  from '../../synth/components/synth/modulation.ts';
import {ReachDirection, blendStops, blendedReach, type BlendEnd} from './modulationBlend.ts';
import {LIVE_SCALE, ModulationPart, sourcePart} from './modulationParts.ts';
import type {ModulationTrackProps} from './modulationTrackProps.ts';

/** The smallest an end circle draws, so it reads beside a line under two pixels thick; a slider's own padding under
 *  its track holds it. */
const END_CIRCLE_MIN = 6;
/** Between circles that stop at the same point, so each stays distinct beside the next. */
const END_GAP = LayoutDimensions.spacing.tightGap;
/** A blended slider draws under its track, inside the padding it already has, and needs no room. */
export const blendedRoom = () => 0;

/** Where an end's circle sits: on its point, or stepped toward the value by a circle and a gap for each end already
 *  there, so a crowd at an edge stays inside the slider's room, and never past the value, so a circle always shows
 *  the direction its source reaches in. */
const stacked = (end: BlendEnd, toward: number, dot: number) => {
  const step = end.stack * (dot + END_GAP);
  if (!step) return `${end.at}%`;
  const up = end.at > toward;
  return `${up ? 'max' : 'min'}(calc(${end.at}% ${up ? '-' : '+'} ${step}px), ${toward}%)`;
};

/** One thin line a direction, coloured across where the sources overlap, with a circle at each source's end in its
 *  own colour: solid, or hollow where the reach runs past the track and stops at its edge. The line and circles sit
 *  just under the track, inside the slider's own box. */
export function BlendedTracks({modulators = [], selectedSource, onSelectSource, low, high, min, max, thickness,
  bottom}: ModulationTrackProps) {
  const style = useStyle().getEffectiveStyle(), {line} = modulationLadder(thickness);
  // A circle is as thick as the value's own bar but never under END_CIRCLE_MIN, and it and the line are centred in
  // the padding under the track.
  const dot = Math.max(thickness, END_CIRCLE_MIN), centre = bottom / 2;
  const colors = modulators.map(modulator => modulatorColor(modulator.root, style));
  const {segments, ends, reaches} = blendedReach(modulators, low, high, min, max);
  return <>
    {segments.map(segment => <div key={`${segment.direction}${segment.from}`}
      {...{[ModulationPart.SEGMENT]: segment.direction}}
      style={{position: 'absolute', left: `${segment.from}%`, width: `${segment.to - segment.from}%`,
        bottom: centre - line / 2, height: line, borderRadius: line, pointerEvents: 'none',
        background: `linear-gradient(90deg, ${blendStops(segment)
          .map(stop => `${colors[stop.source]} ${stop.at}%`).join(', ')})`}}/>)}
    {ends.map(end => {
      const modulator = modulators[end.source], color = colors[end.source];
      const reach = reaches.find(held => held.source === end.source && held.direction === end.direction)!;
      const toward = end.direction === ReachDirection.UP ? reach.from : reach.to;
      const name = `Modulation source ${end.source + 1}${modulator.bipolar
        ? ` ${end.direction === ReachDirection.UP ? 'up' : 'down'}` : ''}`;
      const part = sourcePart(onSelectSource, modulator.source, name);
      const identity = {[ModulationPart.SOURCE]: modulator.source, [ModulationPart.ORDER]: end.source};
      return <div key={`${end.source}${end.direction}`} {...part.attributes} {...identity}
        {...{[ModulationPart.END]: end.direction}}
        style={{...part.style, position: 'absolute', left: stacked(end, toward, dot),
          bottom: centre - dot / 2, width: dot, height: dot,
          transform: 'translateX(-50%)', borderRadius: '50%', boxSizing: 'border-box',
          background: end.clamped ? 'transparent' : color, border: end.clamped ? `1px solid ${color}` : 'none',
          boxShadow: `0 0 ${MODULATOR_GLOW}px ${color}`, transition: MODULATOR_FADE,
          opacity: modulatorOpacity(modulator.source, selectedSource)}}/>;
    })}
    {modulators.map((modulator, index) => {
      const live = reaches.find(reach => reach.source === index)?.live, size = line * LIVE_SCALE;
      return live === undefined ? null : <div key={`live${modulator.source}${index}`}
        {...{[ModulationPart.LIVE]: modulator.source}}
        style={{position: 'absolute', left: `${live}%`, bottom: centre - size / 2, width: size, height: size,
          transform: 'translateX(-50%)', borderRadius: '50%', boxSizing: 'border-box', pointerEvents: 'none',
          background: MODULATOR_LIVE_COLOR, border: `1px solid ${colors[index]}`,
          boxShadow: `0 0 ${MODULATOR_GLOW}px ${colors[index]}`, transition: MODULATOR_FADE,
          opacity: modulatorOpacity(modulator.source, selectedSource)}}/>;
    })}
  </>;
}
