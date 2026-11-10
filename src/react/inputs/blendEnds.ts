import {LayoutDimensions} from '../../layout.ts';
import {ReachDirection, type BlendEnd, type BlendedReach} from './modulationBlend.ts';

export const END_CIRCLE_MIN = 6;
export const END_GAP = LayoutDimensions.spacing.tightGap;
export interface BlendEndGroup {at: number; members: BlendEnd[]}
export const endKey = (end: {source: number; direction: string}) => `${end.source}:${end.direction}`;

/** Coincident ends stay separate when their circles fit before their own bases, otherwise share one circle. */
export function blendEndGroups({ends, reaches}: BlendedReach, width: number, dot: number): BlendEndGroup[] {
  const bases = new Map(reaches.map(reach => [endKey(reach),
    reach.direction === ReachDirection.UP ? reach.from : reach.to]));
  const coincident = new Map<number, BlendEnd[]>();
  for (const end of ends) {
    const group = coincident.get(end.at) ?? [];
    group.push(end);
    coincident.set(end.at, group);
  }
  return [...coincident].flatMap(([at, members]) => {
    if (members.length === 1) return [{at, members}];
    const placed = members.map(end => {
      const toward = bases.get(endKey(end));
      if (toward === undefined) throw new Error(`No reach for end ${endKey(end)}`);
      const step = end.stack * (dot + END_GAP);
      const room = Math.abs(at - toward) * width / 100;
      return {end, fits: step <= room, at: width ? at + Math.sign(toward - at) * step / width * 100 : at};
    });
    if (!width || placed.some(end => !end.fits)) return [{at, members}];
    return placed.map(({end, at: position}) => ({at: position, members: [end]}));
  });
}

/** A source's sector of a shared circle. The circle itself clips the outer edge. */
export function endSlicePath(index: number, count: number, size: number) {
  if (count === 1) return undefined;
  const radius = size / 2, turn = Math.PI * 2;
  const point = (angle: number) => `${radius + radius * Math.cos(angle)},${radius + radius * Math.sin(angle)}`;
  const start = turn * index / count - Math.PI / 2, end = start + turn / count;
  return `path('M${radius},${radius} L${point(start)} A${radius},${radius} 0 0 1 ${point(end)} Z')`;
}
