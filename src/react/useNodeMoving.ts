import React, { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { isPanKeyHeld } from "./panKey.ts";

// Where a node has been moved to, from where it was laid out, in canvas pixels.
export interface NodeMove {
  dx: number;
  dy: number;
}
export type NodeMoves = Readonly<Record<string, NodeMove>>;
interface MovableNode { id: string; x: number; y: number; w: number; h: number }

// A press that travels less than this many screen pixels is a press, not a drag.
const STILL_PX = 4;
const ESCAPE = "Escape";

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
}

// Selecting and moving nodes on a NodeGraph: drag one to move it, drag across empty space to select several (Shift adds
// to the selection, and Shift-click toggles one), then drag any selected node to move them all. Escape or a click on
// empty space clears the selection. Holding Space leaves a drag on empty space to whatever pans the canvas. Points are
// in canvas pixels, read through the surface's box on screen, so any zoom around the graph is accounted for.
export function useNodeMoving<N extends MovableNode>(
  nodes: readonly N[], width: number, moves: NodeMoves, onMovesChange?: (moves: NodeMoves) => void,
) {
  const surface = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [marquee, setMarquee] = useState<Box | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    if (!selected.size) return;
    const key = (e: KeyboardEvent) => { if (e.key === ESCAPE) setSelected(new Set()); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected]);
  if (!onMovesChange) return { surface, marquee, nodeProps: (_id: string) => ({}), surfaceProps: {} };

  const point = (e: ReactPointerEvent): Point => {
    const box = surface.current!.getBoundingClientRect(), perPx = width / box.width;
    return { x: (e.clientX - box.left) * perPx, y: (e.clientY - box.top) * perPx };
  };
  const placedBox = (n: N): Box => ({
    x: n.x + (moves[n.id]?.dx ?? 0), y: n.y + (moves[n.id]?.dy ?? 0), w: n.w, h: n.h,
  });
  type Press = ReactPointerEvent<HTMLDivElement>;
  const begin = (e: Press, kind: Gesture["kind"], ids: readonly string[], keep: ReadonlySet<string>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const screen = { x: e.clientX, y: e.clientY };
    gesture.current = { kind, pointer: e.pointerId, screen, start: point(e), ids, from: moves, keep, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    if (!g.moved && Math.hypot(e.clientX - g.screen.x, e.clientY - g.screen.y) < STILL_PX) return;
    g.moved = true;
    const at = point(e);
    if (g.kind === "marquee") {
      const box = marqueeBox(g.start, at);
      setMarquee(box);
      setSelected(new Set([...g.keep, ...nodes.filter((n) => overlaps(box, placedBox(n))).map((n) => n.id)]));
      return;
    }
    const dx = at.x - g.start.x, dy = at.y - g.start.y;
    const moved = g.ids.map((id) => [id, { dx: (g.from[id]?.dx ?? 0) + dx, dy: (g.from[id]?.dy ?? 0) + dy }]);
    onMovesChange({ ...g.from, ...Object.fromEntries(moved) });
  };
  const end = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId) return;
    gesture.current = null;
    setMarquee(null);
    if (g.kind === "drag" && g.moved) suppressClick.current = true;
    if (g.kind === "marquee" && !g.moved && !e.shiftKey) setSelected(new Set());
  };
  const nodeProps = (id: string) => ({
    "data-selected": selected.has(id) || undefined,
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
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
    },
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
    // A drag or a Shift-click isn't a press on what the node holds.
    onClickCapture: (e: React.MouseEvent) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    },
  });
  const surfaceProps = {
    "data-moving": "",
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || isPanKeyHeld()) return;
      e.stopPropagation();
      begin(e, "marquee", [], e.shiftKey ? selected : new Set());
    },
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  };
  return { surface, marquee, nodeProps, surfaceProps };
}
