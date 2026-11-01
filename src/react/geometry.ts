// =====================================================
// NODE-GRAPH GEOMETRY — pure, domain-free helpers.
// =====================================================

/** Smooth horizontal S-curve (cubic bezier) between two points. */
export function bezierPath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
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
