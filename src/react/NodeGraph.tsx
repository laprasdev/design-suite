// =====================================================
// NodeGraph — a generic node-graph surface. Positions nodes on a fixed pixel
// canvas, draws bezier edges + ports between them in an SVG overlay, and
// (optionally) scales the whole canvas to fit its container width.
//
// Domain-free. The consumer passes:
//   nodes:      [{ id, x, y, w, h, accent?, data? }]
//   edges:      [{ from: [nodeId, side, t?], to: [nodeId, side, t?] }]
//   renderNode: (node) => ReactNode        // content inside each node
//   children:   extra absolutely-positioned overlay content (labels, etc.)
// =====================================================
import React, { useState, useRef, useLayoutEffect, type ReactNode } from "react";
import { Node } from "./Node.tsx";
import { edgePoint, linkPath, type NodeBox, type NodeSide } from "./geometry.ts";

// A node on the canvas: its id, box and accent, and the consumer's own fields.
export interface GraphNode extends NodeBox {
  id: string;
  accent?: boolean;
}
// An edge end: a node, the side it leaves from, and where along that side.
export type EdgeEnd = readonly [id: string, side: NodeSide, t?: number];
export interface GraphEdge {
  from: EdgeEnd;
  to: EdgeEnd;
}
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
}

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
}: NodeGraphProps<N>) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const { ref, scale } = useFitScale(width, fit);

  const links = edges.map((e) => {
    const a = edgePoint(byId[e.from[0]], e.from[1], e.from[2] ?? 0.5);
    const b = edgePoint(byId[e.to[0]], e.to[1], e.to[2] ?? 0.5);
    return { d: linkPath(a, b, e.from[1]), a, b };
  });

  return (
    <div
      className={`bd-nodegraph-fit ${className}`}
      ref={ref}
      style={{ position: "relative", width: "100%", overflow: "hidden", height: fit ? height * scale : height }}
    >
      <div
        className="bd-nodegraph"
        style={{ width, height, transform: fit ? `scale(${scale})` : undefined }}
      >
        <svg
          className="bd-edges"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
        >
          {links.map((l, i) => (
            <path key={i} className="bd-edge" d={l.d} />
          ))}
          {showPorts &&
            links.map((l, i) => (
              <g key={`p${i}`}>
                <circle className="bd-port" cx={l.a.x} cy={l.a.y} r="3.1" />
                <circle className="bd-port" cx={l.b.x} cy={l.b.y} r="3.1" />
              </g>
            ))}
        </svg>

        {children}

        {nodes.map((n) => (
          <Node key={n.id} x={n.x} y={n.y} w={n.w} h={n.h} accent={n.accent}>
            {renderNode(n)}
          </Node>
        ))}
      </div>
    </div>
  );
}
