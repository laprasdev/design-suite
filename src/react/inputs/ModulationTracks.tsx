import React, {type ComponentType} from 'react';
import {ModulationDisplay, type ModulationDisplayValue, type SliderModulationProps}
  from '../../synth/components/synth/modulation.ts';
import {BlendedTracks, blendedRoom} from './BlendedTracks.tsx';
import {SourceLines, sourceLinesRoom} from './SourceLines.tsx';
import type {ModulationTrackProps} from './modulationTrackProps.ts';

/** The form a slider draws its modulators in when it doesn't choose: blended, under the track, so every consumer's
 *  tracks stay where they are. A surface that wants the lines says so. */
export const DEFAULT_MODULATION_DISPLAY = ModulationDisplay.BLENDED;
// Each form: what draws it and the height it needs stacked above a track.
const FORMS: Record<ModulationDisplayValue, {
  Tracks: ComponentType<ModulationTrackProps>; room: (count: number, thickness: number) => number;
}> = {
  [ModulationDisplay.LINES]: {Tracks: SourceLines, room: sourceLinesRoom},
  [ModulationDisplay.BLENDED]: {Tracks: BlendedTracks, room: blendedRoom},
};

/** The one rule for room: modulators never move a track relative to what sits beside it. A slider whose box is its
 *  track (the range and the cell) reserves none, and LINES overflow above it. Only a slider whose track sits under a
 *  row of its own (the setting's value row) takes this much above the track row, and BLENDED needs none anywhere. */
export const modulationRoom = (display: ModulationDisplayValue = DEFAULT_MODULATION_DISPLAY, count: number,
  thickness: number) => FORMS[display].room(count, thickness);

/** The same modulation on cell, setting and range sliders, in the form the slider chose. */
export function ModulationTracks({modulationDisplay = DEFAULT_MODULATION_DISPLAY, ...props}:
  ModulationTrackProps & Pick<SliderModulationProps, 'modulationDisplay'>) {
  const {Tracks} = FORMS[modulationDisplay];
  return <Tracks {...props}/>;
}
