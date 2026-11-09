import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupOutletPosition, nearestGroupOutlet, stepGroupOutlet } from '../src/react/groupOutlets.ts';
import { graphLinks } from '../src/react/wireGeometry.ts';
import { groupFrames } from '../src/react/groupGeometry.ts';
import {
  movedGraph, type GraphNode, type GraphGroup, type GraphEdge, type GroupOutlet,
} from '../src/react/nodeGraphTypes.ts';

const nodes: GraphNode[] = [
  { id: 'source', x: 80, y: 90, w: 120, h: 80 },
  { id: 'left', x: -220, y: 400, w: 120, h: 80 },
  { id: 'right', x: 500, y: 400, w: 120, h: 80 },
];
const frame: GraphGroup = { id: 'group', label: 'Group', x: 40, y: 40, w: 240, h: 200, members: ['source'] };
const edges: GraphEdge[] = ['left', 'right'].map(id =>
  ({ id, from: ['source', 'bottom'], to: [id, 'top'], flow: true }));
const sides = ['top', 'right', 'bottom', 'left'] as const;

test('all walls project to exact fitted bounds and snap along the wall', () => {
  for (const side of sides) {
    const outlet: GroupOutlet = { side, offset: .39 };
    const at = groupOutletPosition(frame, outlet);
    const horizontal = side === 'top' || side === 'bottom';
    assert.equal(horizontal ? (at.x - frame.x) % 8 : (at.y - frame.y) % 8, 0);
    assert.equal(horizontal ? at.y : at.x, horizontal
      ? frame.y + (side === 'bottom' ? frame.h : 0) : frame.x + (side === 'right' ? frame.w : 0));
    assert.equal(nearestGroupOutlet(frame, at).side, side);
    const moved = { ...frame, x: frame.x + 13.5, y: frame.y + 9.2 };
    const shifted = groupOutletPosition(moved, outlet);
    assert.ok(Math.abs(shifted.x - at.x - 13.5) < .00001);
    assert.ok(Math.abs(shifted.y - at.y - 9.2) < .00001);
  }
});

test('keyboard crosses every corner in both directions and clamps reflowed frames', () => {
  let outlet: GroupOutlet = { side: 'top', offset: .5 };
  for (const direction of [1, -1]) {
    const visited = new Set<string>();
    for (let i = 0; i < 140; i++) {
      outlet = stepGroupOutlet(frame, outlet, direction); visited.add(outlet.side);
      const at = groupOutletPosition({ ...frame, w: 80, h: 300 }, outlet);
      assert.ok(Number.isFinite(at.x) && Number.isFinite(at.y));
    }
    assert.deepEqual([...visited].sort(), [...sides].sort());
  }
  assert.throws(() => groupOutletPosition(frame, { side: 'top', offset: NaN }), /Invalid/);
});

test('manual outlets retain real endpoints and rounded orthogonal fan-out through moves and ties', () => {
  const before = structuredClone({ nodes, edges, frame });
  for (const side of sides) {
    const outlet: GroupOutlet = { side, offset: .5 };
    for (const ties of [[], [{ id: 'tie', x: 380, y: 320, edges: ['left', 'right'] }]]) {
      const placed = movedGraph(nodes, [frame], { group: { dx: 13, dy: 7 } });
      const frames = groupFrames(placed.groups, placed.nodes);
      const graph = graphLinks(placed.nodes, edges, ties, frames, { group: outlet });
      assert.deepEqual(graph.outputs[0].at, groupOutletPosition(frames[0], outlet));
      assert.deepEqual(graph.links.map(link => link.id), ['left', 'right']);
      assert.equal(graph.outputs.length, 1);
      for (const link of graph.links) {
        assert.doesNotMatch(link.d, /NaN| C /);
        assert.match(link.d, / Q /);
        assert.equal(link.groupOutput, frame.id);
      }
    }
  }
  assert.deepEqual({ nodes, edges, frame }, before);
});
