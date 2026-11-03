// Screen pixels in a node's own CSS pixels. A CSS zoom on an ancestor scales what the screen reports (bounding boxes,
// pointer positions, the window's size) but not the lengths the node is styled with; with no zoom they're the same.
// A page that zooms sets --css-zoom to the same factor, so styles sized from the viewport (vw, vh) can divide by it.
export const CSS_ZOOM_PROPERTY='--css-zoom';
export const zoomOf=(node: Element)=>(node as Element&{currentCSSZoom?: number}).currentCSSZoom??1;
export interface CssRect {left: number,top: number,right: number,bottom: number,width: number,height: number}
export function cssRect(node: Element,of: Element|Range=node): CssRect {
 const box=of.getBoundingClientRect(),zoom=zoomOf(node);
 return {left:box.left/zoom,top:box.top/zoom,right:box.right/zoom,bottom:box.bottom/zoom,width:box.width/zoom,height:box.height/zoom};
}
// The window's size in the node's CSS pixels.
export const cssViewport=(node: Element)=>({width:window.innerWidth/zoomOf(node),height:window.innerHeight/zoomOf(node)});
