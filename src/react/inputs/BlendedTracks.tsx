import React, {useRef} from 'react';
import {useRoomSize} from '../useRoomSize.ts';
import {BlendedEnds} from './BlendedEnds.tsx';
import {END_CIRCLE_MIN, blendEndGroups} from './blendEnds.ts';
import {useStyle} from '../../synth/StyleContext.tsx';
import {MODULATOR_FADE, MODULATOR_GLOW, MODULATOR_LIVE_COLOR, modulationLadder, modulatorColor, modulatorOpacity}
  from '../../synth/components/synth/modulation.ts';
import {blendStops, blendedReach} from './modulationBlend.ts';
import {LIVE_SCALE, ModulationPart} from './modulationParts.ts';
import type {ModulationTrackProps} from './modulationTrackProps.ts';

/** A blended slider draws under its track, inside the padding it already has, and needs no room. */
export const blendedRoom = () => 0;

/** One thin line a direction, coloured across where the sources overlap, with a circle at each source's end in its
 *  own colour: solid, or hollow where the reach runs past the track and stops at its edge. The line and circles sit
 *  just under the track, inside the slider's own box. */
export function BlendedTracks({modulators = [], selectedSource, onSelectSource, low, high, min, max, thickness,
  bottom}: ModulationTrackProps) {
  const frame = useRef<HTMLDivElement>(null), room = useRoomSize(frame);
  const style = useStyle().getEffectiveStyle(), {line} = modulationLadder(thickness);
  // A circle is as thick as the value's own bar but never under END_CIRCLE_MIN, and it and the line are centred in
  // the padding under the track.
  const dot = Math.max(thickness, END_CIRCLE_MIN), centre = bottom / 2;
  const colors = modulators.map(modulator => modulatorColor(modulator.root, style));
  const blend = blendedReach(modulators, low, high, min, max), {segments, reaches} = blend;
  const groups = blendEndGroups(blend, room?.width ?? 0, dot);
  return <div ref={frame} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    {segments.map(segment => <div key={`${segment.direction}${segment.from}`}
      {...{[ModulationPart.SEGMENT]: segment.direction}}
      style={{position: 'absolute', left: `${segment.from}%`, width: `${segment.to - segment.from}%`,
        bottom: centre - line / 2, height: line, borderRadius: line, pointerEvents: 'none',
        background: `linear-gradient(90deg, ${blendStops(segment)
          .map(stop => `${colors[stop.source]} ${stop.at}%`).join(', ')})`}}/>)}
    <BlendedEnds groups={groups} colors={colors} modulators={modulators} selectedSource={selectedSource}
      onSelectSource={onSelectSource} dot={dot} centre={centre}/>
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
  </div>;
}
