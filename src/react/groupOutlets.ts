import { edgePoint } from './geometry.ts';
import { GROUP_SPACE } from './groupGeometry.ts';
import { GRAPH_GRID } from './graphGrid.ts';
import type { GraphGroup, GraphPoint, GroupOutlet } from './nodeGraphTypes.ts';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const horizontal = (side: GroupOutlet['side']) => side === 'top' || side === 'bottom';
const lengthOf = (frame: GraphGroup, side: GroupOutlet['side']) => horizontal(side) ? frame.w : frame.h;
const insetOf = (frame: GraphGroup) => Math.min(GROUP_SPACE.inset, frame.w / 4, frame.h / 4);

/** Keep the normal coordinate exactly on the fitted wall; snap only along it. */
export function groupOutletPosition(frame: GraphGroup, outlet: GroupOutlet): GraphPoint {
  if (!SIDES.includes(outlet.side) || !Number.isFinite(outlet.offset) || outlet.offset < 0 || outlet.offset > 1) {
    throw new Error('Invalid saved group outlet position.');
  }
  const length = lengthOf(frame, outlet.side), inset = insetOf(frame);
  const along = Math.max(inset, Math.min(length - inset, Math.round(outlet.offset * length / GRAPH_GRID) * GRAPH_GRID));
  return edgePoint(frame, outlet.side, along / length);
}

/** Deterministic nearest-wall projection, retaining the chosen wall at exact corner ties. */
export function nearestGroupOutlet(frame: GraphGroup, point: GraphPoint, previous?: GroupOutlet): GroupOutlet {
  const sides = previous ? [previous.side, ...SIDES.filter(side => side !== previous.side)] : SIDES;
  const candidates = sides.map(side => {
    const offset = Math.max(0, Math.min(1, horizontal(side)
      ? (point.x - frame.x) / frame.w : (point.y - frame.y) / frame.h));
    const at = groupOutletPosition(frame, { side, offset });
    return { side, offset: horizontal(side) ? (at.x - frame.x) / frame.w : (at.y - frame.y) / frame.h,
      distance: Math.hypot(at.x - point.x, at.y - point.y) };
  });
  candidates.sort((a, b) => a.distance - b.distance);
  const { side, offset } = candidates[0];
  return { side, offset };
}

/** Arrows advance around the perimeter; crossing a corner continues on the next wall. */
export function stepGroupOutlet(frame: GraphGroup, outlet: GroupOutlet, direction: number): GroupOutlet {
  const side = outlet.side, at = groupOutletPosition(frame, outlet), length = lengthOf(frame, side);
  const inset = insetOf(frame), along = horizontal(side) ? at.x - frame.x : at.y - frame.y;
  const clockwise = side === 'top' || side === 'right' ? 1 : -1;
  const next = along + direction * clockwise * GRAPH_GRID;
  if (next >= inset && next <= length - inset) return { side, offset: next / length };
  const target = SIDES[(SIDES.indexOf(side) + direction + SIDES.length) % SIDES.length];
  const targetLength = lengthOf(frame, target), forward = target === 'top' || target === 'right';
  return { side: target, offset: (forward === (direction > 0) ? inset : targetLength - inset) / targetLength };
}
