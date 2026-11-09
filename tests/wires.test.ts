import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freeTiePoint, graphLinks, TIE_SIZE, tieWires } from '../src/react/wireGeometry.ts';
import type { GraphEdge, TwistTie } from '../src/react/nodeGraphTypes.ts';

const nodes = [
  { id: 'a', x: 0, y: 0, w: 100, h: 100 },
  { id: 'b', x: 160, y: 250, w: 100, h: 100 },
  { id: 'c', x: 320, y: 250, w: 100, h: 100 },
];
const edges: GraphEdge[] = [
  { id: 'ab', from: ['a', 'bottom'], to: ['b', 'top'], flow: true },
  { id: 'ac', from: ['a', 'bottom'], to: ['c', 'top'] },
];
const tie: TwistTie = { id: 'tie', x: 120, y: 180, edges: ['ab', 'ac'] };

test('optional waypoints draw rounded routes; manual ties override them and untie restores them', () => {
  const routed = edges.map(edge => ({ ...edge, via: [{ x: 50, y: 120 }, { x: 120, y: 120 }, { x: 120, y: 230 }] }));
  const plain = graphLinks(nodes, edges, []).links, automatic = graphLinks(nodes, routed, []).links;
  assert.match(plain[0].d, / C /);
  assert.match(automatic[0].d, / Q /);
  assert.deepEqual(automatic.map(link => [link.a, link.b, link.flow]), plain.map(link => [link.a, link.b, link.flow]));
  assert.deepEqual(graphLinks(nodes, routed, [tie]).links, graphLinks(nodes, edges, [tie]).links);
  assert.deepEqual(graphLinks(nodes, routed, []).links, automatic);
});

test('a tie reroutes both wires while their endpoints and live flow remain intact', () => {
  const plain = graphLinks(nodes, edges, []), tied = graphLinks(nodes, edges, [tie]);
  for (let i = 0; i < edges.length; i++) {
    assert.deepEqual(tied.links[i].a, plain.links[i].a);
    assert.deepEqual(tied.links[i].b, plain.links[i].b);
    assert.notEqual(tied.links[i].d, plain.links[i].d);
    assert.equal(tied.links[i].flow, edges[i].flow);
    assert.ok(!tied.links[i].d.includes('NaN'));
  }
  assert.notEqual(tied.links[0].d, tied.links[1].d, 'a bundle keeps separate, parallel wires');
  assert.notDeepEqual(graphLinks(nodes, edges, [{ ...tie, x: 200 }]).links, tied.links);
});

test('moving nodes updates tied endpoints; hiding members suspends a tie without destroying it', () => {
  const moved = nodes.map(node => node.id === 'a' ? { ...node, x: 60 } : node);
  assert.equal(graphLinks(moved, edges, [tie]).links[0].a.x, 110);
  assert.equal(graphLinks(nodes, edges.slice(0, 1), [tie]).bundles.length, 0);
  assert.equal(graphLinks(nodes, edges, [tie]).bundles.length, 1);
});

test('retying moves membership without giving a wire competing routes', () => {
  const result = tieWires([tie], { id: 'new', x: 0, y: 0, edges: ['ab', 'other'] });
  assert.deepEqual(result.map(item => item.id), ['new']);
  assert.throws(() => tieWires([], { ...tie, edges: ['ab', 'ab'] }), /two different/);
});

test('missing wire endpoints fail explicitly', () => {
  assert.throws(() => graphLinks(nodes.slice(0, 1), edges, []), /missing endpoint/);
});

test('a new tie starts outside cards instead of covering their text', () => {
  const at = freeTiePoint({ x: 50, y: 50 }, nodes);
  assert.ok(at.x - TIE_SIZE.minWidth / 2 > 100 || at.y - TIE_SIZE.height / 2 > 100);
  assert.deepEqual(freeTiePoint({ x: 120, y: 180 }, nodes), { x: 120, y: 180 });
  const moved = nodes.map(node => ({ ...node, x: node.x - 800, y: node.y - 800 }));
  assert.doesNotThrow(() => freeTiePoint({ x: -750, y: -750 }, moved));
});


test('tied wires keep orthogonal legs, small rounded corners and clear intervening cards', () => {
  const crowded = [...nodes, { id: 'obstacle', x: 80, y: 130, w: 70, h: 90 }];
  for (const link of graphLinks(crowded, edges, [tie]).links) {
    assert.ok(!link.d.includes(' C '), 'a tie must not replace orthogonal routes with broad curves');
    let point = { x: 0, y: 0 };
    const commands = link.d.matchAll(/([MLQ]) ([\d.e+-]+) ([\d.e+-]+)(?: ([\d.e+-]+) ([\d.e+-]+))?/g);
    for (const [, command, x, y, endX, endY] of commands) {
      const at = { x: +x, y: +y };
      if (command === 'M') { point = at; continue; }
      const end = command === 'Q' ? { x: +endX, y: +endY } : at;
      assert.ok(point.x === at.x || point.y === at.y, 'each straight leg is axis-aligned');
      if (command === 'Q') {
        assert.ok(at.x === end.x || at.y === end.y);
        assert.ok(Math.hypot(point.x - at.x, point.y - at.y) <= 6.001);
        assert.ok(Math.hypot(end.x - at.x, end.y - at.y) <= 6.001);
      }
      for (let i = 0; i <= 20; i++) {
        const t = i / 20, u = 1 - t;
        const sample = command === 'Q'
          ? { x: u * u * point.x + 2 * u * t * at.x + t * t * end.x,
            y: u * u * point.y + 2 * u * t * at.y + t * t * end.y }
          : { x: point.x + t * (end.x - point.x), y: point.y + t * (end.y - point.y) };
        assert.ok(crowded.every(node => sample.x <= node.x || sample.x >= node.x + node.w ||
          sample.y <= node.y || sample.y >= node.y + node.h), 'a routed wire must stay out of cards');
      }
      point = end;
    }
  }
});
