// What the Button surfaces test renders (buttonSurfacesScene.tsx) and measures: the Buttons a node graph and the sky
// size from their own rules, each found by its owner's element, and the wires the graph's twist tie holds.
import {NodeGraphElement} from '../src/react/nodeGraphElements.ts';
import {ThemeMoonElement} from '../src/react/sky/themeMoonElements.ts';

export const NODE_GRAPH_SIZE=Object.freeze({width:480,height:320});
export const GROUP_LABEL='Group';
export const TIED_EDGES: readonly string[]=Object.freeze(['de','de2']);
export const SizedButtonElement=Object.freeze({
 RESIZE:NodeGraphElement.GROUP_RESIZE,OUTLET:NodeGraphElement.OUTLET_HANDLE,TIE:NodeGraphElement.TWIST_TIE,
 MOON:ThemeMoonElement.BUTTON,
});
