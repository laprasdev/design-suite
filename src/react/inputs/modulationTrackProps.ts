import type {ModulationProps} from '../../synth/components/synth/modulation.ts';

/** What every form of a slider's modulation draws from. The slider hands over its own geometry: `bottom` is the
 *  distance from its box's bottom to its track's bottom edge, and `thumb` the height of what moves along the track
 *  where that is taller than the track, which the lines must clear. */
export interface ModulationTrackProps extends ModulationProps {
  low: number; high: number; min: number; max: number; thickness: number; bottom: number; thumb?: number;
}
