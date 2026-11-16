// The page the Button surfaces test measures in a browser: a node graph with a group (its heading and resize edges),
// a group output handle and a twist tie, and the sky's theme moon, all on a page surface.
import {NodeGraph,ThemeMoon,type GraphEdge,type GraphGroup,type GraphNode,type TwistTie} from '../src/react/index.ts';
import {FanSide} from '../src/react/sky/ThemeMoon.tsx';
import {DEFAULT_SKIN} from '../src/skins.ts';
import {GROUP_LABEL,NODE_GRAPH_SIZE,TIED_EDGES} from './buttonSurfacesCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
// A group of two whose second member's wire leaves it (its output handle), and two wires tied outside the group.
const NODES: readonly GraphNode[]=[{id:'a',x:40,y:60,w:80,h:40},{id:'b',x:40,y:140,w:80,h:40},
 {id:'c',x:340,y:40,w:80,h:40},{id:'d',x:200,y:240,w:80,h:40},{id:'e',x:380,y:240,w:80,h:40}];
const [tiedFirst,tiedSecond]=TIED_EDGES;
const EDGES: readonly GraphEdge[]=[{id:'ab',from:['a','bottom'],to:['b','top']},
 {id:'bc',from:['b','right'],to:['c','left']},{id:tiedFirst,from:['d','right'],to:['e','left']},
 {id:tiedSecond,from:['d','top'],to:['e','top']}];
const GROUPS: readonly GraphGroup[]=[{id:'g',label:GROUP_LABEL,members:['a','b'],x:20,y:20,w:140,h:180}];
const TIES: readonly TwistTie[]=[{id:'t',x:330,y:250,edges:TIED_EDGES}];
renderScene(<div className="page-surface">
 <NodeGraph {...NODE_GRAPH_SIZE} nodes={NODES} edges={EDGES} groups={GROUPS} groupOutputs showPorts outlets={{}}
  onOutletsChange={ignore} onGroupToggle={ignore} onGroupResize={ignore} ties={TIES} onTiesChange={ignore}
  renderNode={node=>node.id}/>
 <ThemeMoon skins={[]} skin={DEFAULT_SKIN} onSkin={ignore} fan={()=>FanSide.LEFT} onOpen={ignore}/>
</div>);
