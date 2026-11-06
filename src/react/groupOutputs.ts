import { edgePoint, type NodeSide } from "./geometry.ts";
import { groupOutletPosition } from "./groupOutlets.ts";
import { GROUP_SPACE } from "./groupGeometry.ts";
import { graphRoutes } from "./graphRoutes.ts";
import {
  graphEdgeId, type GraphEdge, type GraphGroup, type GraphNode, type GraphPoint, type GroupOutlets,
} from "./nodeGraphTypes.ts";

const OPPOSITE: Record<NodeSide, NodeSide> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const SIDES = ["top", "right", "bottom", "left"] as const;
const distance = (a: GraphPoint, b: GraphPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Private routing anchors never enter the graph's nodes, saved edge ids or tie membership.
function anchorId(group: GraphGroup, nodes: readonly GraphNode[]) {
  let id = JSON.stringify(["group-output", group.id]);
  while (nodes.some(node => node.id === id)) id += ":";
  return id;
}

function wallPoint(group: GraphGroup, side: NodeSide, point: GraphPoint): GraphPoint {
  if (side === "top" || side === "bottom") return { x: point.x, y: group.y + (side === "bottom" ? group.h : 0) };
  return { x: group.x + (side === "right" ? group.w : 0), y: point.y };
}

// Walk the shorter direction around the frame; the entry and outlet remain exact wall points.
function perimeter(group: GraphGroup, entry: GraphPoint, from: NodeSide, exit: GraphPoint, to: NodeSide) {
  const corners = [
    { x: group.x + group.w, y: group.y }, { x: group.x + group.w, y: group.y + group.h },
    { x: group.x, y: group.y + group.h }, { x: group.x, y: group.y },
  ];
  if (from === to) return [entry, exit];
  const paths = [1, -1].map(direction => {
    const points = [entry];
    let side = SIDES.indexOf(from);
    while (SIDES[side] !== to) {
      points.push(corners[(side + (direction < 0 ? 3 : 0)) % 4]);
      side = (side + direction + 4) % 4;
    }
    return [...points, exit];
  });
  const length = (points: GraphPoint[]) =>
    points.slice(1).reduce((sum, point, i) => sum + distance(points[i], point), 0);
  return length(paths[0]) <= length(paths[1]) ? paths[0] : paths[1];
}

/** One terminal output port can fan out to several consumers, sharing one feed and boundary outlet. */
export function groupOutputRoutes(
  nodes: readonly GraphNode[], edges: readonly GraphEdge[], groups: readonly GraphGroup[], outlets: GroupOutlets = {},
) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  return groups.flatMap(group => {
    const members = new Set(group.members);
    const outgoing = edges.filter(edge => members.has(edge.from[0]) && !members.has(edge.to[0]));
    if (!outgoing.length) return [];
    const source = outgoing[0].from;
    const samePort = outgoing.every(edge => edge.from[0] === source[0] && edge.from[1] === source[1]
      && (edge.from[2] ?? .5) === (source[2] ?? .5));
    const terminal = !edges.some(edge => edge.from[0] === source[0] && members.has(edge.to[0]));
    if (!samePort || !terminal) return [];
    const node = byId.get(source[0]);
    if (!node) throw new Error(`Group output has a missing source: ${source[0]}`);
    const targets = outgoing.map(edge => {
      const target = byId.get(edge.to[0]);
      if (!target) throw new Error(`Group output has a missing target: ${edge.to[0]}`);
      return edgePoint(target, edge.to[1], edge.to[2]);
    });
    const center = targets.reduce((sum, point) => ({ x: sum.x + point.x / targets.length,
      y: sum.y + point.y / targets.length }), { x: 0, y: 0 });
    const dx = (center.x - group.x - group.w / 2) / group.w;
    const dy = (center.y - group.y - group.h / 2) / group.h;
    const side: NodeSide = outlets[group.id]?.side
      ?? (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "top" : "bottom"));
    const port = edgePoint(node, source[1], source[2]), entry = wallPoint(group, source[1], port);
    // A port near the trailing corner makes the boundary run visible even when the next node is directly below.
    const inset = Math.min(GROUP_SPACE.inset, group.w / 4, group.h / 4);
    const at = outlets[group.id] ? groupOutletPosition(group, outlets[group.id])
      : wallPoint(group, side, { x: group.x + group.w - inset, y: group.y + group.h - inset });
    const id = anchorId(group, nodes), gate = { id, x: entry.x, y: entry.y, w: 0, h: 0 };
    const feed = graphRoutes(nodes, [{ ...outgoing[0], id: graphEdgeId(outgoing[0]),
      to: [id, OPPOSITE[source[1]]] }], edgePoint, new Map(), [gate])[0];
    const points = [port, ...feed.via!, ...perimeter(group, entry, source[1], at, side)];
    return [{ group: group.id, frame: group, ids: outgoing.map(graphEdgeId), side, at, points,
      cornerRadius: feed.cornerRadius, node: { ...gate, x: at.x, y: at.y } }];
  });
}
