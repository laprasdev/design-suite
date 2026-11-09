import { WIRE_CORNER_RADIUS } from "./wirePath.ts";
import { edgePoint, type NodeBox } from "./geometry.ts";
import { graphEdgeId, type GraphEdge, type GraphNode, type GraphPoint } from "./nodeGraphTypes.ts";

type Point = Pick<GraphNode, 'x' | 'y'>;
export const GRAPH_ROUTE_SPACE = Object.freeze({ clearance: 10, bend: 12 });
const NORMAL = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const sorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

// Keep visible gaps open when the owner brings cards close together. Overlapping cards still need their port stems.
function routeClearance(nodes: readonly NodeBox[]) {
  let clearance: number = GRAPH_ROUTE_SPACE.clearance;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    const dx = Math.max(0, a.x - b.x - b.w, b.x - a.x - a.w);
    const dy = Math.max(0, a.y - b.y - b.h, b.y - a.y - a.h);
    const gap = Math.max(dx, dy);
    if (gap > 0) clearance = Math.min(clearance, gap / 2);
  }
  return clearance;
}

// A small priority queue keeps routing proportional to the channels explored, rather than scanning the whole grid.
class Frontier {
  entries: [number, number][] = [];
  push(id: number, cost: number) {
    const value: [number, number] = [id, cost];
    let at = this.entries.length;
    this.entries.push(value);
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (this.entries[parent][1] <= cost) break;
      this.entries[at] = this.entries[parent]; at = parent;
    }
    this.entries[at] = value;
  }
  pop() {
    const first = this.entries[0], last = this.entries.pop()!;
    if (!this.entries.length) return first[0];
    let at = 0;
    while (at * 2 + 1 < this.entries.length) {
      let child = at * 2 + 1;
      if (child + 1 < this.entries.length && this.entries[child + 1][1] < this.entries[child][1]) child++;
      if (last[1] <= this.entries[child][1]) break;
      this.entries[at] = this.entries[child]; at = child;
    }
    this.entries[at] = last;
    return first[0];
  }
}

// Channels follow padded card boundaries. Even a wire from the project to a later wrapped row stays outside cards.
// The graph's dependency IDs and ports are unchanged; these points describe only the drawing.
export function graphRoutes(
  nodes: readonly GraphNode[], edges: readonly GraphEdge[], portAt: typeof edgePoint = edgePoint,
  through: ReadonlyMap<string, readonly GraphPoint[]> = new Map(),
  // Geometry-only endpoints are not cards: they neither block channels nor reduce clearance.
  anchors: readonly GraphNode[] = [],
  barriers: readonly NodeBox[] = [],
): GraphEdge[] {
  if (!edges.length) return [];
  const clearance = routeClearance([...nodes, ...barriers]);
  const cornerRadius = Math.min(WIRE_CORNER_RADIUS, clearance * 2);
  const byId = new Map([...nodes, ...anchors].map(node => [node.id, node]));
  const ports = edges.map(edge => [edge.from, edge.to].map(end => {
    const node = byId.get(end[0]);
    if (!node) throw new Error(`Route has a missing node: ${end[0]}`);
    const port = portAt(node, end[1], end[2]), normal = NORMAL[end[1]];
    return { x: port.x + normal.x * clearance,
      y: port.y + normal.y * clearance, normal };
  }));
  const boxes = [...nodes, ...barriers].map(node => ({ left: node.x - clearance,
    right: node.x + node.w + clearance,
    top: node.y - clearance, bottom: node.y + node.h + clearance }));
  const guides = [...through.values()].flat();
  const xs = sorted([...boxes.flatMap(box => [box.left, (box.left + box.right) / 2, box.right]),
    ...ports.flatMap(pair => pair.map(port => port.x)), ...guides.map(point => point.x)]);
  const ys = sorted([...boxes.flatMap(box => [box.top, (box.top + box.bottom) / 2, box.bottom]),
    ...ports.flatMap(pair => pair.map(port => port.y)), ...guides.map(point => point.y)]);
  const columns = xs.length, size = columns * ys.length;
  const xIndex = new Map(xs.map((x, i) => [x, i])), yIndex = new Map(ys.map((y, i) => [y, i]));
  const blocked = new Uint8Array(size);
  for (const box of boxes) {
    for (let y = yIndex.get(box.top)! + 1; y < yIndex.get(box.bottom)!; y++) {
      for (let x = xIndex.get(box.left)! + 1; x < xIndex.get(box.right)!; x++) blocked[y * columns + x] = 1;
    }
  }
  const point = (id: number): Point => ({ x: xs[id % columns], y: ys[Math.floor(id / columns)] });
  const entrance = (port: typeof ports[number][number]) => {
    let x = xIndex.get(port.x)!, y = yIndex.get(port.y)!;
    // If the owner overlaps cards while dragging, the short port stem exits the overlap before taking a channel.
    while (blocked[y * columns + x]) { x += port.normal.x; y += port.normal.y; }
    if (x < 0 || x >= columns || y < 0 || y >= ys.length) throw new Error('No channel outside a graph port');
    return y * columns + x;
  };
  const route = (start: number, finish: number, label: string): Point[] => {
    const goal = point(finish), frontier = new Frontier();
    const costs = new Float64Array(size).fill(Infinity), previous = new Int32Array(size).fill(-1);
    const visited = new Uint8Array(size);
    costs[start] = 0; frontier.push(start, 0);
    while (frontier.entries.length) {
      const at = frontier.pop();
      if (at === finish) break;
      if (visited[at]) continue;
      visited[at] = 1;
      const here = point(at), x = at % columns, y = Math.floor(at / columns);
      const neighbors = [x > 0 ? at - 1 : -1, x + 1 < columns ? at + 1 : -1,
        y > 0 ? at - columns : -1, y + 1 < ys.length ? at + columns : -1];
      for (const next of neighbors) {
        if (next < 0 || blocked[next] || visited[next]) continue;
        const there = point(next), before = previous[at] < 0 ? null : point(previous[at]);
        const turn = before && (before.x === here.x) !== (here.x === there.x);
        const travel = Math.abs(there.x - here.x) + Math.abs(there.y - here.y);
        const cost = costs[at] + travel + (turn ? GRAPH_ROUTE_SPACE.bend : 0);
        if (cost >= costs[next]) continue;
        costs[next] = cost; previous[next] = at;
        frontier.push(next, cost + Math.abs(there.x - goal.x) + Math.abs(there.y - goal.y));
      }
    }
    if (!Number.isFinite(costs[finish])) throw new Error(`No wire channel: ${label}`);
    const path: Point[] = [];
    for (let at = finish; at !== -1; at = previous[at]) path.push(point(at));
    return path.reverse();
  };
  return edges.map((edge, index) => {
    const anchors = [entrance(ports[index][0]), ...(through.get(graphEdgeId(edge)) ?? []).map(guide => {
      const id = yIndex.get(guide.y)! * columns + xIndex.get(guide.x)!;
      if (blocked[id]) throw new Error(`Wire guide is inside a node: ${graphEdgeId(edge)}`);
      return id;
    }), entrance(ports[index][1])];
    const path = anchors.slice(1).flatMap((finish, i) => {
      const segment = route(anchors[i], finish, `${edge.from[0]} → ${edge.to[0]}`);
      return i ? segment.slice(1) : segment;
    });
    return { ...edge, ...(cornerRadius < WIRE_CORNER_RADIUS && { cornerRadius }), via: path.filter((p, i) => {
      const before = path[i - 1], after = path[i + 1];
      return !before || !after || (before.x === p.x) !== (p.x === after.x);
    }) };
  });
}
