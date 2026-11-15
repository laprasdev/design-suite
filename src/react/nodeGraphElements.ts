import {element} from './elementContract.ts';

// What a node graph draws: its fitted frame and surface, each node (accented or not) and the marquee; a group, its
// heading and resize edges; the wire layer, each wire (flowing or not, a group's output), its lights, ports and hit
// path, a group's outlet and its handle; the sweep, a twist tie and its knot, and the actions over picked wires.
export const NodeGraphElement=Object.freeze({
 FIT:element('bd-nodegraph-fit'),SURFACE:element('bd-nodegraph'),NODE:element('bd-node'),
 NODE_ACCENT:element('bd-node--accent'),MARQUEE:element('bd-marquee'),GROUP:element('bd-node-group'),
 GROUP_HEADING:element('bd-node-group-heading'),GROUP_RESIZE:element('bd-node-group-resize'),
 EDGES:element('bd-edges'),EDGE:element('bd-edge'),EDGE_FLOW:element('bd-edge--flow'),
 EDGE_OUTPUT:element('bd-edge-output'),EDGE_HIT:element('bd-edge-hit'),FLOW:element('bd-flow'),
 FLOW_LIGHT:element('bd-flow-light'),PORT:element('bd-port'),OUTLET:element('bd-group-outlet'),
 OUTLET_HANDLE:element('bd-group-outlet-handle'),WIRE_SWEEP:element('bd-wire-sweep'),TWIST_TIE:element('bd-twist-tie'),
 TIE_KNOT:element('bd-tie-knot'),WIRE_ACTIONS:element('bd-wire-actions'),
});
// The group heading's height, which nodegraph.css authors on the graph and the heading's Button takes.
export const NODE_HEADING_HEIGHT_PROPERTY='--bd-node-heading-height';
