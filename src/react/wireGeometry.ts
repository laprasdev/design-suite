import { edgePoint, linkPath } from "./geometry.ts";
import { graphRoutes, GRAPH_ROUTE_SPACE } from "./graphRoutes.ts";
import { wirePath, WIRE_CORNER_RADIUS } from "./wirePath.ts";
import { groupOutputRoutes } from "./groupOutputs.ts";
import type { NodeBox } from "./geometry.ts";
import { graphEdgeId, type GraphEdge, type GraphGroup, type GraphNode, type GraphPoint,
  type TwistTie } from "./nodeGraphTypes.ts";

export const WIRE_GAP = 4;
export const TIE_GRID = 8, TIE_RUN = 24;
export const snapTie = (point: GraphPoint): GraphPoint => ({
  x: Math.round(point.x / TIE_GRID) * TIE_GRID, y: Math.round(point.y / TIE_GRID) * TIE_GRID,
});
export const TIE_SIZE = Object.freeze({ minWidth: 24, height: 14, clearance: GRAPH_ROUTE_SPACE.clearance });
export const tieWidth = (wires: number) => Math.max(TIE_SIZE.minWidth, wires * WIRE_GAP + 8);
export const bundleVertical = (links: readonly { a: GraphPoint; b: GraphPoint }[]) => {
  const dx = links.reduce((sum, link) => sum + link.b.x - link.a.x, 0);
  const dy = links.reduce((sum, link) => sum + link.b.y - link.a.y, 0);
  return Math.abs(dy) >= Math.abs(dx);
};
export const wireMiddle = ({ a, b }: { a: GraphPoint; b: GraphPoint }): GraphPoint => ({
  x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
});

// A newly tied bundle starts in a gap, rather than over a card's label.
export function freeTiePoint(
  at: GraphPoint, boxes: readonly NodeBox[],
  size: Pick<NodeBox, "w" | "h"> = { w: TIE_SIZE.minWidth, h: TIE_SIZE.height },
): GraphPoint {
  const px = size.w / 2 + TIE_SIZE.clearance, py = size.h / 2 + TIE_SIZE.clearance;
  const clear = (point: GraphPoint) => point.x >= Math.min(px, at.x) &&
    point.y >= Math.min(py, at.y) && boxes.every(box =>
    point.x <= box.x - px || point.x >= box.x + box.w + px ||
    point.y <= box.y - py || point.y >= box.y + box.h + py);
  const candidates = [at, ...boxes.flatMap(box => [
    { x: box.x - px, y: at.y }, { x: box.x + box.w + px, y: at.y },
    { x: at.x, y: box.y - py }, { x: at.x, y: box.y + box.h + py },
  ])].filter(clear);
  candidates.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
  if (!candidates.length) throw new Error("No clear position for a twist tie.");
  return candidates[0];
}

export function graphLinks(nodes: readonly GraphNode[], edges: readonly GraphEdge[], ties: readonly TwistTie[],
  groups: readonly GraphGroup[] = []) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const ends = edges.map(edge => {
    const from = byId.get(edge.from[0]), to = byId.get(edge.to[0]);
    if (!from || !to) throw new Error(`Wire has a missing endpoint: ${edge.from[0]} → ${edge.to[0]}`);
    return { edge, id: graphEdgeId(edge),
      a: edgePoint(from, edge.from[1], edge.from[2] ?? .5),
      b: edgePoint(to, edge.to[1], edge.to[2] ?? .5) };
  });
  const active = new Set(ends.map(end => end.id));
  const bundles = ties.map(tie => {
    const members = tie.edges.filter(id => active.has(id));
    const links = ends.filter(end => members.includes(end.id));
    const vertical = bundleVertical(links), span = tieWidth(members.length);
    const position = freeTiePoint(tie, nodes,
      { w: vertical ? span : TIE_RUN * 2, h: vertical ? TIE_RUN * 2 : span });
    return { ...tie, ...position, members, vertical };
  }).filter(tie => tie.members.length > 1);
  const through = new Map<string, GraphPoint[]>();
  for (const bundle of bundles) for (const id of bundle.members) {
    const end = ends.find(end => end.id === id)!;
    const offset = (bundle.members.indexOf(id) - (bundle.members.length - 1) / 2) * WIRE_GAP;
    const at = { x: bundle.x + (bundle.vertical ? offset : 0), y: bundle.y + (bundle.vertical ? 0 : offset) };
    const direction = Math.sign(bundle.vertical ? end.b.y - end.a.y : end.b.x - end.a.x) || 1;
    const run = bundle.vertical ? { x: 0, y: TIE_RUN * direction } : { x: TIE_RUN * direction, y: 0 };
    through.set(id, [{ x: at.x - run.x, y: at.y - run.y }, { x: at.x + run.x, y: at.y + run.y }]);
  }
  const outputs = groupOutputRoutes(nodes, edges, groups);
  const outputByEdge = new Map(outputs.flatMap(output => output.ids.map(id => [id, output] as const)));
  const routed = new Map(graphRoutes(nodes,
    edges.filter(edge => through.has(graphEdgeId(edge)) && !outputByEdge.has(graphEdgeId(edge))), edgePoint, through)
    .map(edge => [graphEdgeId(edge), edge]));
  for (const output of outputs) {
    const outgoing = edges.filter(edge => output.ids.includes(graphEdgeId(edge)))
      .map(edge => ({ ...edge, id: graphEdgeId(edge), from: [output.node.id, output.side] as const }));
    // Ties own external routing. A frame may also grow over another card; in that case real cards,
    // rather than the enclosing drawing frame, determine the destination's entrance channel.
    const reentry = (edge: GraphEdge) => {
      if (through.has(graphEdgeId(edge))) return true;
      const target = byId.get(edge.to[0])!, frame = output.frame;
      return !(target.x > frame.x + frame.w || target.x + target.w < frame.x
        || target.y > frame.y + frame.h || target.y + target.h < frame.y);
    };
    for (const manual of [false, true]) {
      const branches = outgoing.filter(edge => reentry(edge) === manual);
      const guides = new Map([...through].filter(([id]) => branches.some(edge => graphEdgeId(edge) === id)));
      for (const edge of graphRoutes(nodes, branches, edgePoint, guides, [output.node], manual ? [] : [output.frame])) {
        routed.set(graphEdgeId(edge), edge);
      }
    }
  }
  const drawings = new Map(outputs.map(output => {
    const routes = output.ids.map(id => routed.get(id)!);
    const first = routes[0].via![0];
    const run = Math.min(...routes.map(route => Math.abs(route.via![0].x - output.at.x)
      + Math.abs(route.via![0].y - output.at.y)));
    const split = { x: output.at.x + Math.sign(first.x - output.at.x) * run / 2,
      y: output.at.y + Math.sign(first.y - output.at.y) * run / 2 };
    const radius = Math.min(output.cornerRadius ?? WIRE_CORNER_RADIUS,
      ...routes.map(route => route.cornerRadius ?? WIRE_CORNER_RADIUS));
    return [output.group, { split, radius, d: wirePath([...output.points, split], radius) }] as const;
  }));
  const links = ends.map(({ edge, id, a, b }) => {
    const route = routed.get(id) ?? edge, via = route.via;
    const output = outputByEdge.get(id);
    const drawing = output && drawings.get(output.group)!;
    const prefix = output ? [...output.points, drawing!.split] : [a], radius = drawing?.radius ?? route.cornerRadius;
    const d = via?.length ? wirePath([...prefix, ...via, b], radius) : linkPath(a, b, edge.from[1]);
    return { id, d, a, b, flow: edge.flow, color: edge.color,
      ...(output && { groupOutput: output.group, branch: wirePath([drawing!.split, ...via!, b], radius) }),
      label: edge.label ?? `${edge.from[0]} → ${edge.to[0]}` };
  });
  return { links, bundles, outputs: outputs.map(output => {
    return { group: output.group, ids: output.ids, at: output.at,
      flow: edges.some(edge => output.ids.includes(graphEdgeId(edge)) && edge.flow), d: drawings.get(output.group)!.d };
  }) };
}

/** Retie selected wires; keep every other bundle and never give one wire two competing routes. */
export function tieWires(ties: readonly TwistTie[], added: TwistTie): TwistTie[] {
  if (new Set(added.edges).size < 2) throw new Error("A twist tie needs at least two different wires.");
  return [...ties.map(tie => ({ ...tie, edges: tie.edges.filter(id => !added.edges.includes(id)) }))
    .filter(tie => tie.edges.length > 1), added];
}
