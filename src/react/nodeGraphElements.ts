import {element} from './elementContract.ts';

// The Buttons a node graph draws: a group's heading and its resize edges, a group output's handle, and a twist tie.
export const NodeGraphElement=Object.freeze({
 GROUP_HEADING:element('bd-node-group-heading'),GROUP_RESIZE:element('bd-node-group-resize'),
 OUTLET_HANDLE:element('bd-group-outlet-handle'),TWIST_TIE:element('bd-twist-tie'),
});
// The group heading's height, which nodegraph.css authors on the graph and the heading's Button takes.
export const NODE_HEADING_HEIGHT_PROPERTY='--bd-node-heading-height';
