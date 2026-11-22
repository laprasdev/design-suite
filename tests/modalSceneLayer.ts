// An anchored Modal in the dismissal scene (modalScene.ts): its layer is a fragment, its marker and then its panel, and
// the panel is drawn once the marker is attached where the Modal renders. Where the panel sits is not what the scene
// plays, so its placement styles nothing.
import type {Plugin} from 'esbuild';

interface Marker {ref(node: object): void}
const isMarker=(node: unknown): node is Marker=>!!node&&typeof node==='object'&&'ref' in node&&
 typeof node.ref==='function';
// Attaches the marker an anchored Modal rendered to `node`, and whether it rendered one.
export function attachedMarker(rendered: unknown,node: object) {
 const props: unknown=rendered&&typeof rendered==='object'&&'props' in rendered?rendered.props:undefined;
 const parts: unknown=props&&typeof props==='object'&&'children' in props?props.children:undefined;
 const marker: unknown=Array.isArray(parts)?parts[0]:undefined;
 if(isMarker(marker))marker.ref(node);
 return isMarker(marker);
}
export const UNPLACED: Plugin={name:'unplaced',setup(builder) {
 builder.onResolve({filter:/useAnchoredPopover\.ts$/},()=>({path:'useAnchoredPopover',namespace:'unplaced'}));
 builder.onLoad({filter:/.*/,namespace:'unplaced'},()=>({contents:'export const useAnchoredPopover = () => ({});'}));
}};
