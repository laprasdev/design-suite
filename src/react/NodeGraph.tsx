// =====================================================
// NodeGraph — a generic node-graph surface. Positions nodes on a fixed pixel
// canvas, draws bezier edges + ports between them in an SVG overlay, and
// (optionally) scales the whole canvas to fit its container width.
//
// Domain-free. The consumer passes:
//   nodes:      [{ id, x, y, w, h, accent?, data? }]
//   edges:      [{ from: [nodeId, side, t?], to: [nodeId, side, t?], flow? }]
//   renderNode: (node) => ReactNode        // content inside each node
//   children:   extra absolutely-positioned overlay content (labels, etc.)
//
// With `onMovesChange`, nodes can be moved (see useNodeMoving): drag one, or select several and drag them together.
// `moves` are offsets from each node's laid-out place, which the consumer keeps.
// An edge with `flow` carries a few lights along it, for work moving through.
// `groups` draw collapsible member frames; drag their headings to move them with their members.
// Group offsets share `moves` with nodes; the consumer owns folding and layout.
// `onTiesChange` enables Shift-drag wire sweeps and twist ties; Alt-drag selects nodes.
// `onGroupResize` enables gestures on every group edge; the consumer reflows its members.
// Keep `ties` alongside moves. Edge ids must remain stable when nodes move.
// `interactionSurface` can extend selection to a surrounding pan/zoom viewport.
// =====================================================
import React, { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Node } from "./Node.tsx";
import { GraphWires } from "./GraphWires.tsx";
import { NodeGroups } from "./NodeGroups.tsx";
import { groupFrames } from "./groupGeometry.ts";
import type { GraphNode, GraphEdge, GraphGroup, GraphGroupResize, GroupOutlets, TwistTie } from "./nodeGraphTypes.ts";
import { movedGraph } from "./nodeGraphTypes.ts";
export { graphEdgeId, movedGraph } from "./nodeGraphTypes.ts";
export type {
  GraphNode, GraphEdge, GraphGroup, GraphGroupResize, GroupEdge, GroupResizePhase,
  GroupOutlet, GroupOutlets, EdgeEnd, TwistTie,
} from "./nodeGraphTypes.ts";
import { useNodeMoving, type NodeMoves } from "./useNodeMoving.ts";

export type { NodeMove, NodeMoves } from "./useNodeMoving.ts";

export interface NodeGraphProps<N extends GraphNode> {
  width: number;
  height: number;
  nodes: readonly N[];
  edges?: readonly GraphEdge[];
  renderNode(node: N): ReactNode;
  fit?: boolean;
  showPorts?: boolean;
  className?: string;
  children?: ReactNode;
  moves?: NodeMoves;
  onMovesChange?(moves: NodeMoves): void;
  groups?: readonly GraphGroup[];
  /** Route a single terminal output along each expanded group boundary. */
  groupOutputs?: boolean;
  outlets?: GroupOutlets;
  onOutletsChange?(outlets: GroupOutlets): void;
  onGroupToggle?(id: string): void;
  onGroupResize?: GraphGroupResize;
  ties?: readonly TwistTie[];
  onTiesChange?(ties: readonly TwistTie[]): void;
  interactionSurface?: RefObject<HTMLElement | null>;
}

const NO_MOVES: NodeMoves = Object.freeze({});

function useFitScale(contentWidth: number, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / contentWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentWidth, enabled]);
  return { ref, scale };
}

export function NodeGraph<N extends GraphNode>({
  width,
  height,
  nodes,
  edges = [],
  renderNode,
  fit = true,
  showPorts = true,
  className = "",
  children,
  moves = NO_MOVES,
  onMovesChange, groups = [], groupOutputs = false, onGroupToggle, onGroupResize,
  ties, onTiesChange, outlets, onOutletsChange, interactionSurface,
}: NodeGraphProps<N>) {
  const { ref, scale } = useFitScale(width, fit);
  const marqueeKey = onTiesChange ? "altKey" : "shiftKey";
  const { surface, marquee, selection, nodeProps, groupProps, surfaceProps } = useNodeMoving(
    nodes, width, moves, onMovesChange, marqueeKey, groups);
  const { nodes: shown, groups: moved } = movedGraph(nodes, groups, moves);
  const frames = groupFrames(moved, shown);

  return (
    <div
      className={`bd-nodegraph-fit ${className}`}
      ref={ref}
      data-organizing={!!(onMovesChange || onTiesChange || onGroupResize || onOutletsChange) || undefined}
      style={{ height: fit ? height * scale : height }}
    >
      <div
        className="bd-nodegraph"
        ref={surface}
        style={{ width, height, transform: fit ? `scale(${scale})` : undefined }}
        {...surfaceProps}
      >
        <NodeGroups groups={frames} nodes={shown} onToggle={onGroupToggle} onResize={onGroupResize}
          groupProps={groupProps} />
        <GraphWires surface={surface} width={width} height={height} nodes={shown} edges={edges}
          groups={groupOutputs ? frames : undefined} showPorts={showPorts} ties={ties}
          onTiesChange={onTiesChange} interactionSurface={interactionSurface}
          outlets={outlets} onOutletsChange={onOutletsChange} nodeSelection={selection} />

        {children}

        {shown.map((n) => (
          <Node key={n.id} x={n.x} y={n.y} w={n.w} h={n.h} accent={n.accent} {...nodeProps(n.id)}>
            {renderNode(n)}
          </Node>
        ))}
        {marquee && (
          <div
            className="bd-marquee"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
          />
        )}
      </div>
    </div>
  );
}
