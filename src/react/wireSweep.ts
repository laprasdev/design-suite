import type { GraphPoint } from "./nodeGraphTypes.ts";

const SAMPLE_STEP = 6, HIT_SLOP = 3;
export interface SweepWire { id: string; points: GraphPoint[] }
export function sampleWires(element: Element): SweepWire[] {
  return [...element.querySelectorAll<SVGPathElement>(".bd-edge-hit")].map(path => {
    const length = path.getTotalLength(), steps = Math.max(1, Math.ceil(length / SAMPLE_STEP));
    return { id: path.dataset.wire!, points: Array.from({ length: steps + 1 }, (_, i) => {
      const point = path.getPointAtLength(length * i / steps);
      return { x: point.x, y: point.y };
    }) };
  });
}
const distance = (point: GraphPoint, a: GraphPoint, b: GraphPoint) => {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
};
const cross = (a: GraphPoint, b: GraphPoint, c: GraphPoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const crosses = (a: GraphPoint, b: GraphPoint, c: GraphPoint, d: GraphPoint) => {
  if (Math.max(a.x, b.x) + HIT_SLOP < Math.min(c.x, d.x) || Math.max(c.x, d.x) + HIT_SLOP < Math.min(a.x, b.x) ||
    Math.max(a.y, b.y) + HIT_SLOP < Math.min(c.y, d.y) ||
    Math.max(c.y, d.y) + HIT_SLOP < Math.min(a.y, b.y)) return false;
  return (cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) ||
    Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b)) <= HIT_SLOP;
};
export function collectWires(wires: readonly SweepWire[], from: GraphPoint, to: GraphPoint): string[] {
  return wires.filter(wire => wire.points.slice(1).some((point, i) => crosses(from, to, wire.points[i], point)))
    .map(wire => wire.id);
}
