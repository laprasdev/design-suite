import type { NodeBox, NodeSide } from "./geometry.ts";

export const GRAPH_WIRE_ATTRIBUTE = 'data-wire';
export const GRAPH_NODE_ATTRIBUTE = 'data-graph-node';

export interface GraphNode extends NodeBox { id: string; accent?: boolean }
/** Offsets from the layout; member offsets are relative to their group's offset. */
export interface NodeMove { dx: number; dy: number }
export type NodeMoves = Readonly<Record<string, NodeMove>>;
export type EdgeEnd = readonly [id: string, side: NodeSide, t?: number];
export interface GraphEdge {
  id?: string;
  from: EdgeEnd;
  to: EdgeEnd;
  flow?: boolean;
  color?: string;
  label?: string;
  /** Optional drawing waypoints. Manual twist ties take precedence over an automatic route. */
  via?: readonly GraphPoint[];
  /** A tighter corner when cards leave a narrow routing channel. */
  cornerRadius?: number;
}
export interface GraphPoint { x: number; y: number }
/** A routing handle. Membership changes only the drawing, never the graph's connections. */
export interface TwistTie extends GraphPoint { id: string; edges: readonly string[] }
/** An expanded group, with its members still present in the node list. */
export interface GraphGroup extends NodeBox {
  id: string; label: string; members: readonly string[]; completed?: boolean;
}
/** Saved wall-relative output position, independent of layout/movement. */
export interface GroupOutlet { side: NodeSide; offset: number }
export type GroupOutlets = Readonly<Record<string, GroupOutlet>>;
export type GroupEdge = NodeSide;
export type GroupResizePhase = "start" | "move" | "end" | "cancel";
export type GraphGroupResize = (id: string, size: Pick<NodeBox, "w" | "h">,
  edge: GroupEdge, phase: GroupResizePhase) => void;
export interface WireLink {
  id: string;
  d: string;
  groupOutput?: string;
  a: GraphPoint;
  b: GraphPoint;
  flow?: boolean;
  color?: string;
  label: string;
}

/** A graph's node selection as its wires see it: whether a move or marquee of the nodes is under way, and its clear. */
export interface NodeSelection { underWay(): boolean; clear(): void }
export const graphEdgeId = (edge: GraphEdge): string => edge.id ?? JSON.stringify([edge.from, edge.to]);

/** Apply the same placement to frames, cards, hit testing and wire routing. */
export function movedGraph<N extends GraphNode>(nodes: readonly N[], groups: readonly GraphGroup[], moves: NodeMoves) {
  const parents = new Map(groups.flatMap(group => group.members.map(id => [id, moves[group.id]] as const)));
  return {
    nodes: nodes.map(node => ({ ...node,
      x: node.x + (moves[node.id]?.dx ?? 0) + (parents.get(node.id)?.dx ?? 0),
      y: node.y + (moves[node.id]?.dy ?? 0) + (parents.get(node.id)?.dy ?? 0) })),
    groups: groups.map(group => ({ ...group,
      x: group.x + (moves[group.id]?.dx ?? 0), y: group.y + (moves[group.id]?.dy ?? 0) })),
  };
}
