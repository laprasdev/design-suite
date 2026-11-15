// What the Button surfaces test renders (buttonSurfacesScene.tsx) and measures: the Buttons a node graph and the sky
// size from their own rules, each found by its class, and the wires the graph's twist tie holds.
export const NODE_GRAPH_SIZE=Object.freeze({width:480,height:320});
export const GROUP_LABEL='Group';
export const TIED_EDGES: readonly string[]=Object.freeze(['de','de2']);
export const SizedButtonElement=Object.freeze({
 RESIZE:'.bd-node-group-resize',OUTLET:'.bd-group-outlet-handle',TIE:'.bd-twist-tie',MOON:'.theme-moon-button',
});
