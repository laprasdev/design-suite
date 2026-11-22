// The anchored Modals the layer test opens (anchoredLayerScene.tsx): one from an element and one from a point, each
// inside a small box that clips everything it holds, its fixed descendants too, and a point below the first box. The
// point's panel grows a frame after it is placed and marks the added content, so the test sees where growth holds it.
export const CASE_ATTRIBUTE='data-case',PANEL_CASE_ATTRIBUTE='data-panel-case',GROWN_ATTRIBUTE='data-grown';
export const AnchoredCase=Object.freeze({ELEMENT:'element',POINT:'point'} as const);
export const CLIPPING_BOX=Object.freeze({widthPx:120,heightPx:40,gapPx:200});
export const OPENED_AT=Object.freeze({x:20,y:CLIPPING_BOX.gapPx+CLIPPING_BOX.heightPx+20});
