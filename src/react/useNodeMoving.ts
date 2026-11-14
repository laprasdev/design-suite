import React, { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EscapeCancel, useEscapeCancel } from "./controlCancel.ts";
import { isPanKeyHeld } from "./panKey.ts";
import { movedGraph, type GraphNode, type GraphGroup, type NodeMoves } from "./nodeGraphTypes.ts";
export type { NodeMove, NodeMoves } from "./nodeGraphTypes.ts";

// A press that travels less than this many screen pixels is a press, not a drag.
const STILL_PX = 4;

interface Box { x: number; y: number; w: number; h: number }
interface Point { x: number; y: number }
const marqueeBox = (a: Point, b: Point): Box => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y),
});
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
interface Gesture {
  kind: "drag" | "marquee";
  pointer: number;
  screen: Point;
  start: Point;
  ids: readonly string[];
  from: NodeMoves;
  keep: ReadonlySet<string>;
  moved: boolean;
  pressed?: string;
}

// Selecting and moving nodes on a NodeGraph: drag one to move it, Shift and a drag across empty space selects several
// (adding to the selection; Shift-click toggles one), then drag any selected node to move them all. Escape, a press on
// empty space or a plain click on a node clears the selection. A plain drag on empty space is left to whatever pans the
// canvas, as in any node editor. Points are in canvas pixels, read through the surface's box on screen, so any zoom
// around the graph is accounted for.
export function useNodeMoving<N extends GraphNode>(
  nodes: readonly N[], width: number, moves: NodeMoves, onMovesChange?: (moves: NodeMoves) => void,
  marqueeKey: "shiftKey" | "altKey" = "shiftKey",
  groups: readonly GraphGroup[] = [],
) {
  const surface = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [marquee, setMarquee] = useState<Box | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const cancel = (event?: ReactPointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g || (event && event.pointerId !== g.pointer)) return;
    gesture.current = null;
    if (g.kind === "drag" && g.moved) onMovesChange?.(g.from);
    suppressClick.current = true;
    setMarquee(null);
  };
  // Escape cancels a move or a marquee under way, and the selection with it, before any Modal around the graph sees the
  // key; with nothing under way it clears the selection, once every Modal and focused control has let the key pass.
  useEscapeCancel(EscapeCancel.UNDER_WAY, () => {
    if (!gesture.current) return false;
    cancel(); setSelected(new Set()); return true;
  });
  useEscapeCancel(EscapeCancel.SELECTION, () => {
    if (!selected.size) return false;
    setSelected(new Set()); return true;
  });
  if (!onMovesChange) return {
    surface, marquee, nodeProps: (_id: string) => ({}), groupProps: (_id: string) => ({}), surfaceProps: {},
  };

  const point = (e: ReactPointerEvent): Point => {
    const box = surface.current!.getBoundingClientRect(), perPx = width / box.width;
    return { x: (e.clientX - box.left) * perPx, y: (e.clientY - box.top) * perPx };
  };
  const placed = movedGraph(nodes, groups, moves).nodes;
  type Press = ReactPointerEvent<HTMLElement>;
  const begin = (e: Press, kind: Gesture["kind"], ids: readonly string[], keep: ReadonlySet<string>) => {
    // Keep a button press targeted at the button; capturing its wrapper swallows the eventual click.
    const target = (e.target as Element).closest("button,a,[role=button]") ?? e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const screen = { x: e.clientX, y: e.clientY };
    gesture.current = { kind, pointer: e.pointerId, screen, start: point(e), ids, from: moves, keep, moved: false };
  };
  const move = (e: Press) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    if (!g.moved && Math.hypot(e.clientX - g.screen.x, e.clientY - g.screen.y) < STILL_PX) return;
    g.moved = true;
    const at = point(e);
    if (g.kind === "marquee") {
      const box = marqueeBox(g.start, at);
      setMarquee(box);
      setSelected(new Set([...g.keep, ...placed.filter(n => overlaps(box, n)).map(n => n.id)]));
      return;
    }
    const dx = at.x - g.start.x, dy = at.y - g.start.y;
    const moved = g.ids.map((id) => [id, { dx: (g.from[id]?.dx ?? 0) + dx, dy: (g.from[id]?.dy ?? 0) + dy }]);
    onMovesChange({ ...g.from, ...Object.fromEntries(moved) });
  };
  const end = (e: Press) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    gesture.current = null;
    setMarquee(null);
    if (g.kind === "drag" && g.moved) suppressClick.current = true;
    if (g.kind === "drag" && !g.moved && g.pressed) setSelected(new Set());
  };
  const dragProps = {
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
    // A drag or a Shift-click isn't a press on what the node or group holds.
    onClickCapture: (e: React.MouseEvent) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      if (e.detail === 0) return; // Only suppress the pointer gesture's click, never keyboard activation.
      e.stopPropagation(); e.preventDefault();
    },
  };
  const groupProps = (id: string) => ({
    ...dragProps,
    "data-moving": "",
    onPointerDown: (e: Press) => {
      if (e.button !== 0) return;
      suppressClick.current = false;
      e.stopPropagation();
      setSelected(new Set());
      begin(e, "drag", [id], new Set());
    },
  });
  const nodeProps = (id: string) => ({
    ...dragProps,
    "data-selected": selected.has(id) || undefined,
    onPointerDown: (e: Press) => {
      if (e.button !== 0) return;
      suppressClick.current = false;
      e.stopPropagation();
      if (e.shiftKey) {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
        suppressClick.current = true;
        begin(e, "drag", next.has(id) ? [...next] : [], next);
        return;
      }
      const group = selected.has(id) ? [...selected] : [id];
      if (!selected.has(id)) setSelected(new Set());
      begin(e, "drag", group, selected);
      gesture.current!.pressed = id;
    },
  });
  const surfaceProps = {
    "data-moving": "",
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || isPanKeyHeld()) return;
      if (!e[marqueeKey]) { if (selected.size) setSelected(new Set()); return; }
      e.stopPropagation();
      begin(e, "marquee", [], selected);
    },
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: cancel,
  };
  return { surface, marquee, nodeProps, groupProps, surfaceProps };
}
