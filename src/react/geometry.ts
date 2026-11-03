// =====================================================
// NODE-GRAPH GEOMETRY — pure, domain-free helpers.
// =====================================================

/** Smooth horizontal S-curve (cubic bezier) between two points. */
export function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

/** Smooth vertical S-curve between two points, for a link that leaves a node's bottom or top. */
export function verticalBezierPath(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

/** The curve a link takes: vertical when it leaves a node's top or bottom, horizontal from its sides. */
export function linkPath(from: { x: number; y: number }, to: { x: number; y: number }, side: NodeSide) {
  const vertical = side === "top" || side === "bottom";
  return (vertical ? verticalBezierPath : bezierPath)(from.x, from.y, to.x, to.y);
}

/**
 * A point on a node's edge. `side` is left/right/top/bottom; `t` (0..1) is the
 * fractional position along that edge. A node is { x, y, w, h }.
 */
export interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type NodeSide = "left" | "right" | "top" | "bottom";
export function edgePoint(node: NodeBox, side: NodeSide, t = 0.5) {
  switch (side) {
    case "left":
      return { x: node.x, y: node.y + node.h * t };
    case "right":
      return { x: node.x + node.w, y: node.y + node.h * t };
    case "top":
      return { x: node.x + node.w * t, y: node.y };
    case "bottom":
      return { x: node.x + node.w * t, y: node.y + node.h };
    default:
      return { x: node.x, y: node.y };
  }
}
