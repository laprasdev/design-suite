import React, {forwardRef, useId, useImperativeHandle, type HTMLAttributes, type ReactNode,
  type RefObject} from 'react';
import {useStyle, useStyleContext} from '../synth/StyleContext.tsx';
import {designTokens} from '../skins.ts';
import {O, SCALE} from '../synth/design/index.ts';
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
