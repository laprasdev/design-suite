import React, {forwardRef, useId, useImperativeHandle, type HTMLAttributes, type ReactNode,
  type RefObject} from 'react';
import {useStyle, useStyleContext} from '../synth/StyleContext.tsx';
import {designTokens} from '../skins.ts';
import {O, SCALE} from '../synth/design/index.ts';
import {graphDots, graphEdgeFade, type GraphEdge} from './graphSurface.ts';
import {usePanZoom, detailAt, ZOOM, type GraphViewport} from './usePanZoom.ts';
import {Button} from './Button.tsx';
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

/** A sampled curve's fill. Calculation remains with its owning model. */
export function GraphFill({path}: {path: string}) {
  const id = `graph-fill-${useId().replace(/:/g, '')}`, {primaryColor} = useStyle().getEffectiveStyle();
  return <>
    <defs><linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor={primaryColor} stopOpacity={O.low}/>
      <stop offset="50%" stopColor={primaryColor} stopOpacity={O.faint}/>
      <stop offset="100%" stopColor={primaryColor} stopOpacity={O.ghost}/>
    </linearGradient></defs>
    <path d={path} fill={`url(#${id})`}/>
  </>;
}
