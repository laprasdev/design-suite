import {RangeEnd, type ControlModulator} from '../../synth/components/synth/modulation.ts';

export const ReachDirection = Object.freeze({DOWN: 'down', UP: 'up'} as const);
export type ReachDirectionValue = typeof ReachDirection[keyof typeof ReachDirection];

/** A stretch of a line where the same sources overlap, in percent of the track. Sources are named by their place in
 *  the control's list of modulators, which is the order they keep here and in the socket. */
export interface BlendBand {from: number; to: number; sources: number[]}
/** One thin line in one direction: its unbroken bands. Sources that share a base make exactly one per direction. */
export interface BlendSegment {direction: ReachDirectionValue; from: number; to: number; bands: BlendBand[]}
/** Where a source's reach stops, in percent of the track. A reach past either end of the track stops at that edge
 *  and says so; one that begins past it still draws its circle there rather than vanishing. */
export interface BlendEnd {source: number; direction: ReachDirectionValue; at: number; clamped: boolean;
  /** Its place among the ends that stop at the same point: 0 for the first, which stays on the point; each later one
   *  draws a circle further in, so no circle covers another. */
  stack: number}
/** One direction a source reaches from its base, in percent of the track, drawn in the control's own units: a depth in
 *  frames spans that many frames of a frames track, and a reach past the track stops at its edge, marked `clamped`.
 *  `live` is where the source's current sample puts the value, when it has one. */
export interface BlendReach {source: number; direction: ReachDirectionValue; from: number; to: number;
  clamped: boolean; live?: number}
export interface BlendedReach {reaches: BlendReach[]; segments: BlendSegment[]; ends: BlendEnd[]}
/** A colour stop along a segment, in percent of the segment's own length, naming the source that colours it. */
export interface BlendStop {at: number; source: number}

/** Each modulator reaches up from its base for a positive depth and down for a negative one, and both ways when
 *  bipolar. */
function reachesOf(modulators: readonly ControlModulator[], low: number, high: number,
  min: number, max: number): BlendReach[] {
  const span = max - min, percent = (value: number) => Math.min(1, Math.max(0, (value - min) / span)) * 100;
  return modulators.flatMap((modulator, index) => {
    const base = (modulator.end ?? RangeEnd.END) === RangeEnd.ORIGIN ? low : high, size = Math.abs(modulator.depth);
    const live = modulator.sample === undefined ? undefined : percent(base + modulator.sample * modulator.depth);
    const reach = (direction: ReachDirectionValue, far: number): BlendReach => {
      const [from, to] = direction === ReachDirection.UP ? [base, far] : [far, base];
      return {source: index, direction, from: percent(from), to: percent(to), clamped: far < min || far > max, live};
    };
    const up = reach(ReachDirection.UP, base + size), down = reach(ReachDirection.DOWN, base - size);
    return modulator.bipolar ? [down, up] : [modulator.depth >= 0 ? up : down];
  });
}

function segmentOf(direction: ReachDirectionValue, reaches: readonly BlendReach[]): BlendSegment[] {
  const breaks = [...new Set(reaches.flatMap(reach => [reach.from, reach.to]))].sort((a, b) => a - b);
  const bands = breaks.slice(1).map((to, index): BlendBand => {
    const from = breaks[index];
    const sources = reaches.filter(reach => reach.from <= from && reach.to >= to).map(reach => reach.source);
    return {from, to, sources};
  }).filter(band => band.sources.length > 0);
  return bands.reduce<BlendSegment[]>((runs, band) => {
    const last = runs.at(-1);
    if (last && last.to === band.from) {
      last.bands.push(band);
      last.to = band.to;
    } else runs.push({direction, from: band.from, to: band.to, bands: [band]});
    return runs;
  }, []);
}

/** The lines and end circles a blended slider draws: where each source reaches from the value, how the sources
 *  overlap along each direction, and where each stops. */
export function blendedReach(modulators: readonly ControlModulator[], low: number, high: number,
  min: number, max: number): BlendedReach {
  const reaches = reachesOf(modulators, low, high, min, max);
  const segments = Object.values(ReachDirection)
    .flatMap(direction => segmentOf(direction, reaches.filter(reach => reach.direction === direction)));
  const placed = reaches.map(({source, direction, from, to, clamped}) =>
    ({source, direction, at: direction === ReachDirection.UP ? to : from, clamped}));
  const ends = placed.map((end, index): BlendEnd =>
    ({...end, stack: placed.slice(0, index).filter(earlier => earlier.at === end.at).length}));
  return {reaches, segments, ends};
}

/** The stops of a segment's gradient: a band of one source is that colour from edge to edge, and where several overlap
 *  their colours run across the band in order. Neighbouring bands meet at a hard edge, where a source ends. */
export function blendStops(segment: BlendSegment): BlendStop[] {
  const length = segment.to - segment.from, at = (value: number) => (value - segment.from) / length * 100;
  return segment.bands.flatMap(band => band.sources.length === 1
    ? [{at: at(band.from), source: band.sources[0]}, {at: at(band.to), source: band.sources[0]}]
    : band.sources.map((source, index) =>
      ({at: at(band.from + (band.to - band.from) * index / (band.sources.length - 1)), source})));
}
