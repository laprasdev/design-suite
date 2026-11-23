import React, {forwardRef, useId, useImperativeHandle, type HTMLAttributes, type ReactNode,
  type RefObject} from 'react';
import {useStyle, useStyleContext} from '../synth/StyleContext.tsx';
import {designTokens} from '../skins.ts';
import {O, SCALE} from '../synth/design/index.ts';
import {hexToRgba} from '../color.ts';
import {LayoutDimensions} from '../layout.ts';
import {graphDots, graphEdgeFade, type GraphEdge} from './graphSurface.ts';
import {usePanZoom, detailAt, ZOOM, type GraphViewport} from './usePanZoom.ts';
import {Button} from './Button.tsx';
import {GraphFillForm, type GraphFillFormValue} from './graphFillForm.ts';
const FRAME = {min: 260, max: 640, readableMax: 800, inset: 48};
const CANVAS_FADE = {left: '5%', right: '5%', top: '7%', bottom: '12%'};
export type GraphDisplayProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  fadeEdges?: readonly GraphEdge[]; viewport?: GraphViewport; controls?: ReactNode;
  children?: ReactNode | ((frame: RefObject<HTMLDivElement>) => ReactNode);
};
/** One graph surface; a viewport adds navigation around the same frame. */
export const GraphDisplay = forwardRef<HTMLDivElement, GraphDisplayProps>(
  function GraphDisplay({style, fadeEdges, viewport, controls, children, className = '', ...props}, ref) {
    const colors = useStyleContext()?.getEffectiveStyle();
    const navigation = usePanZoom(viewport), {frame, view, handlers, zoomBy, fit} = navigation;
    useImperativeHandle(ref, () => {if (!frame.current) throw new Error('Graph frame is not mounted');
      return frame.current;}, []);
    const height = !viewport || viewport.fill ? '100%' : viewport.expand ? viewport.height + FRAME.inset
      : Math.min(viewport.readable ? FRAME.readableMax : FRAME.max, Math.max(FRAME.min,
        viewport.height + (viewport.readable ? FRAME.inset : 0)));
    const content = typeof children === 'function' ? children(frame) : children;
    return <div {...props} ref={frame} className={['bd-graph-display', viewport && 'graph-canvas',
      className].filter(Boolean).join(' ')}
      data-detail={viewport ? detailAt(view.scale) : undefined} data-scale={viewport ? view.scale : undefined}
        data-expanded={viewport?.expand || undefined}
      style={{position: 'relative', height, background: viewport ? undefined : colors?.cutoutBackground
        ?? 'var(--stage)',
        ...graphEdgeFade(viewport ? CANVAS_FADE : designTokens.graphInset / SCALE, viewport?.fill
          || viewport?.expand ? [] : fadeEdges),
        ...(viewport ? graphDots() : {}), ...style}}
      {...(viewport ? handlers : {})} onPointerDown={event => {
        if (viewport && (!viewport.expand || event.pointerType !== 'touch')) handlers.onPointerDown(event);
        props.onPointerDown?.(event);
      }}>
      {viewport ? <div className="graph-world"
        style={{transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        width: viewport.width}}>{content}</div> : content}
      {viewport && <div className="graph-corner">
        {controls && <div className="graph-tools">{controls}</div>}
        <div className="graph-zoom">
          <Button labelKind="value" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM.step)}>−</Button>
          <Button labelKind="value" aria-label="Fit" onClick={fit}>{Math.round(view.scale * 100)}%</Button>
          <Button labelKind="value" aria-label="Zoom in" onClick={() => zoomBy(ZOOM.step)}>+</Button>
        </div>
      </div>}
    </div>;
  });

/** Each fill form's gradient, from the curve down: top, middle and bottom opacity. Lit is the plain fill a step
 *  brighter at every stop, so the running part reads as the same curve, lit. */
const GRAPH_FILL_STOPS: Readonly<Record<GraphFillFormValue, readonly [number, number, number]>> = {
  [GraphFillForm.PLAIN]: [O.low, O.faint, O.ghost],
  [GraphFillForm.LIT]: [O.high, O.low, O.faint],
};
const STOP_OFFSETS = ['0%', '50%', '100%'] as const;

/** A sampled curve's fill in its form. Calculation remains with its owning model. */
export function GraphFill({path, form}: {path: string; form: GraphFillFormValue}) {
  const id = `graph-fill-${useId().replace(/:/g, '')}`, {primaryColor} = useStyle().getEffectiveStyle();
  return <>
    <defs><linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
      {GRAPH_FILL_STOPS[form].map((opacity, index) =>
        <stop key={STOP_OFFSETS[index]} offset={STOP_OFFSETS[index]} stopColor={primaryColor} stopOpacity={opacity}/>)}
    </linearGradient></defs>
    <path data-graph-fill={form} d={path} fill={`url(#${id})`}/>
  </>;
}

const {graphGlow, graphHandleRadius} = LayoutDimensions.envelope;
/** The glow a graph's curve and its handle share. */
export const graphGlowFilter = (color: string) => `drop-shadow(0 0 ${graphGlow}px ${hexToRgba(color, O.low)})`;
/** Where a `GraphHandle` sits, as a share of its graph's width and height. */
export interface GraphHandlePlace {x: number; y: number}
/** `handle` moved to `place` and shown, or hidden when `place` is null. The place moves each frame, so this writes
 *  numbers into the circle's percentage lengths (set once by `GraphHandle`), never text. */
export function placeGraphHandle(handle: SVGCircleElement, place: GraphHandlePlace | null) {
  handle.style.visibility = place ? HANDLE_SHOWN : HANDLE_HIDDEN;
  if (!place) return;
  handle.cx.baseVal.valueInSpecifiedUnits = place.x * PERCENT;
  handle.cy.baseVal.valueInSpecifiedUnits = place.y * PERCENT;
}
const HANDLE_SHOWN = 'visible', HANDLE_HIDDEN = 'hidden', PERCENT = 100, ORIGIN = '0%';
/** The glowing mark that rides a graph's curve at the running place, laid over the whole graph in pixels so it stays
 *  round however the curve's view stretches; hidden until its owner places it with `placeGraphHandle`. */
export const GraphHandle = forwardRef<SVGCircleElement>(function GraphHandle(_props, ref) {
  const {primaryColor} = useStyle().getEffectiveStyle();
  return <svg aria-hidden width="100%" height="100%" style={{position: 'absolute', inset: 0, overflow: 'visible',
    pointerEvents: 'none'}}>
    <circle ref={ref} data-graph-handle cx={ORIGIN} cy={ORIGIN} r={graphHandleRadius} fill={primaryColor}
      style={{visibility: HANDLE_HIDDEN, filter: graphGlowFilter(primaryColor)}}/>
  </svg>;
});
