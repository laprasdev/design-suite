import type { GraphPoint } from "./nodeGraphTypes.ts";

export const WIRE_CORNER_RADIUS = 6;

// Small rounded corners on a routed wire, with exact ports at either end.
export function wirePath(points: readonly GraphPoint[], cornerRadius = WIRE_CORNER_RADIUS) {
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const before = points[i - 1], at = points[i], after = points[i + 1];
    const incoming = Math.hypot(at.x - before.x, at.y - before.y);
    const outgoing = Math.hypot(after.x - at.x, after.y - at.y);
    if (!incoming || !outgoing) continue;
    const radius = Math.min(cornerRadius, incoming / 2, outgoing / 2);
    const enter = { x: at.x - (at.x - before.x) * radius / incoming,
      y: at.y - (at.y - before.y) * radius / incoming };
    const leave = { x: at.x + (after.x - at.x) * radius / outgoing,
      y: at.y + (after.y - at.y) * radius / outgoing };
    path += ` L ${enter.x} ${enter.y} Q ${at.x} ${at.y} ${leave.x} ${leave.y}`;
  }
  const end = points[points.length - 1];
  return `${path} L ${end.x} ${end.y}`;
}
