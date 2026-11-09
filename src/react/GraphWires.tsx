import React, { useMemo, type RefObject } from "react";
import { Cable, X } from "lucide-react";
import { Button } from "./Button.tsx";
import {
  bundleVertical, freeTiePoint, graphLinks, TIE_SIZE, TIE_RUN, snapTie, tieWidth, tieWires, wireMiddle,
} from "./wireGeometry.ts";
import { nearestGroupOutlet, stepGroupOutlet } from "./groupOutlets.ts";
import { useWireGestures } from "./useWireGestures.ts";
import type { GraphEdge, GraphGroup, GraphNode, GraphPoint, GroupOutlets, TwistTie } from "./nodeGraphTypes.ts";

const FLOW_LIGHTS = 3, FLOW_SECONDS = 2.4, TIE_STEP = 8;
const NO_OUTLETS: GroupOutlets = Object.freeze({});
const NO_TIES: readonly TwistTie[] = Object.freeze([]);

function FlowLights({ path }: { path: string }) {
  return <g className="bd-flow">{Array.from({ length: FLOW_LIGHTS }, (_, k) => (
    <circle key={k} className="bd-flow-light" r="2.6">
      <animateMotion dur={`${FLOW_SECONDS}s`} begin={`${(-k * FLOW_SECONDS) / FLOW_LIGHTS}s`}
        repeatCount="indefinite" path={path} />
    </circle>
  ))}</g>;
}

export function GraphWires({
  surface, width, height, nodes, edges, groups, showPorts, ties = NO_TIES, onTiesChange, interactionSurface,
  outlets = NO_OUTLETS, onOutletsChange,
}: {
  surface: RefObject<HTMLDivElement | null>; width: number; height: number;
  nodes: readonly GraphNode[]; edges: readonly GraphEdge[]; groups?: readonly GraphGroup[]; showPorts: boolean;
  outlets?: GroupOutlets; onOutletsChange?(outlets: GroupOutlets): void;
  ties?: readonly TwistTie[]; onTiesChange?(ties: readonly TwistTie[]): void;
  interactionSurface?: RefObject<HTMLElement | null>;
}) {
  const { links, bundles, outputs } = useMemo(
    () => graphLinks(nodes, edges, ties, groups, outlets), [nodes, edges, ties, groups, outlets]);
  const collect = (ids: readonly string[], at: GraphPoint) => {
    const selected = links.filter(link => ids.includes(link.id));
    const vertical = bundleVertical(selected), span = tieWidth(selected.length);
    const position = freeTiePoint(snapTie(at), nodes,
      { w: vertical ? span : TIE_RUN * 2, h: vertical ? TIE_RUN * 2 : span });
    onTiesChange?.(tieWires(ties, { id: `tie:${crypto.randomUUID()}`, edges: ids, ...position }));
  };
  const wires = useWireGestures(surface, width, links, ties, onTiesChange, collect,
    interactionSurface, outlets, onOutletsChange);
  const picked = links.filter(link => wires.selected.includes(link.id));
  const middle = picked.length ? {
    x: picked.reduce((sum, link) => sum + wireMiddle(link).x, 0) / picked.length,
    y: picked.reduce((sum, link) => sum + wireMiddle(link).y, 0) / picked.length,
  } : { x: 0, y: 0 };
  const tie = () => { collect(wires.selected, middle); wires.clear(); };
  const untie = (id: string) => onTiesChange?.(ties.filter(item => item.id !== id));
  return <>
    <svg data-graph-wires className="bd-edges" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      aria-hidden={(!onTiesChange && !onOutletsChange) || undefined}>
      {links.map(link => <path key={link.id} data-selected={wires.selected.includes(link.id) || undefined}
        className={`bd-edge${link.flow ? " bd-edge--flow" : ""}`} data-group-source={link.groupOutput}
        style={link.color ? {'--bd-edge-stroke': link.color} as React.CSSProperties : undefined}
        d={link.branch ?? link.d} />)}
      {outputs.map(output => <path key={`output:${output.group}`} data-group-output={output.group}
        data-selected={output.ids.some(id => wires.selected.includes(id)) || undefined}
        className={`bd-edge bd-edge-output${output.flow ? " bd-edge--flow" : ""}`} d={output.d} />)}
      {showPorts && outputs.map(output => <circle key={`outlet:${output.group}`} className="bd-port bd-group-outlet"
        data-group-outlet={output.group} cx={output.at.x} cy={output.at.y} r="3.1" />)}
      {links.map(link => link.flow && <FlowLights key={`flow:${link.id}`} path={link.d} />)}
      {showPorts && links.map(link => <g key={`ports:${link.id}`} aria-hidden="true">
        <circle className="bd-port" cx={link.a.x} cy={link.a.y} r="3.1" />
        <circle className="bd-port" cx={link.b.x} cy={link.b.y} r="3.1" />
      </g>)}
      {onTiesChange && links.map(link => <path key={`hit:${link.id}`} className="bd-edge-hit" d={link.d}
        data-wire={link.id} role="button" tabIndex={0} aria-label={`Select wire: ${link.label}`}
        aria-pressed={wires.selected.includes(link.id)} onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); wires.select(link.id, event.shiftKey); }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault(); wires.select(link.id, event.shiftKey);
          }
        }}>
        <title>{link.label} · Shift-click to add · Shift-drag to collect and tie wires</title>
      </path>)}
      {wires.sweep.length > 1 && <path className="bd-wire-sweep"
        d={wires.sweep.map((point, i) => `${i ? "L" : "M"} ${point.x} ${point.y}`).join(" ")} />}
    </svg>
    {showPorts && onOutletsChange && outputs.map(output => {
      const position = outlets[output.group] ?? nearestGroupOutlet(output.frame, output.at);
      return <Button key={`handle:${output.group}`} variant="text" className="bd-group-outlet-handle"
        data-group-outlet-handle={output.group} aria-label={`Move ${output.frame.label} output`}
        title="Drag along any wall · Arrows move around the frame · Delete restores automatic placement"
        style={{ left: output.at.x, top: output.at.y }}
        onPointerDown={event => wires.startOutlet(event, output.frame, position)}
        onClick={event => event.stopPropagation()} onKeyDown={event => {
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault(); event.stopPropagation();
            const next = { ...outlets }; delete next[output.group]; onOutletsChange(next); return;
          }
          const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
          if (!direction) return;
          event.preventDefault(); event.stopPropagation();
          onOutletsChange({ ...outlets, [output.group]: stepGroupOutlet(output.frame, position, direction) });
        }} />;
    })}
    {onTiesChange && bundles.map(bundle => <Button key={bundle.id} className="bd-twist-tie" variant="ghost"
      aria-label={`Twist tie: ${bundle.members.length} wires`}
      title="Drag to route · Arrows to move · Double-click or Delete to untie"
      style={{ left: bundle.x, top: bundle.y, width: tieWidth(bundle.members.length), height: TIE_SIZE.height,
        transform: `translate(-50%,-50%) rotate(${bundle.vertical ? 0 : 90}deg)` }}
      onPointerDown={event => wires.startTie(event, bundle)} onDoubleClick={() => untie(bundle.id)}
      onKeyDown={event => {
        if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); untie(bundle.id); }
        const step = { ArrowLeft: [-TIE_STEP, 0], ArrowRight: [TIE_STEP, 0],
          ArrowUp: [0, -TIE_STEP], ArrowDown: [0, TIE_STEP] }[event.key];
        if (!step) return;
        event.preventDefault();
        onTiesChange(ties.map(item => item.id === bundle.id
          ? { ...item, x: item.x + step[0], y: item.y + step[1] } : item));
      }}><span className="bd-tie-knot" aria-hidden="true" /></Button>)}
    {onTiesChange && picked.length > 0 && !wires.sweep.length && <div className="bd-wire-actions"
      style={{ left: middle.x, top: middle.y }}
      onPointerDown={event => event.stopPropagation()}>
      <Button variant="ghost" disabled={picked.length < 2} onClick={tie} aria-label="Tie selected wires">
        <Cable size={16} aria-hidden="true" />{picked.length} wires
      </Button>
      <Button variant="subtle" onClick={wires.clear} aria-label="Clear wire selection"><X size={16} /></Button>
    </div>}
  </>;
}
