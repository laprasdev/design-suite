import React, { useRef, type PointerEvent } from "react";
import { Button } from "./Button.tsx";
import type { GraphGroup, GraphGroupResize, GroupEdge } from "./nodeGraphTypes.ts";

const EDGES = {
  top: { axis: "h", sign: -1 }, right: { axis: "w", sign: 1 },
  bottom: { axis: "h", sign: 1 }, left: { axis: "w", sign: -1 },
} as const;
const STILL_PX = 4;
interface Drag { pointer: number; x: number; y: number; w: number; h: number; scale: number; moved: boolean }
export function GroupResize({ group, onResize, step }: {
  group: GraphGroup; onResize: GraphGroupResize; step: number;
}) {
  const drag = useRef<Drag | null>(null);
  const resize = (event: PointerEvent<HTMLButtonElement>, edge: GroupEdge, finish = false) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const travel = Math.hypot(event.clientX - current.x, event.clientY - current.y);
    if (!current.moved && travel >= STILL_PX) current.moved = true;
    const { axis, sign } = EDGES[edge];
    const distance = axis === "w" ? event.clientX - current.x : event.clientY - current.y;
    const size = { w: current.w, h: current.h, [axis]: current[axis] + sign * distance / current.scale };
    if (current.moved) onResize(group.id, size, edge, finish ? "end" : "move");
    else if (finish) onResize(group.id, size, edge, "cancel");
    if (finish) drag.current = null;
  };
  return (Object.keys(EDGES) as GroupEdge[]).map(edge =>
    <Button key={edge} variant="text" className="bd-node-group-resize" data-edge={edge}
    aria-label={`Reshape ${group.label} from ${edge}`} title={`Drag ${edge} edge to reflow nodes · Arrows to reshape`}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      const box = event.currentTarget.parentElement!.getBoundingClientRect();
      drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
        w: group.w, h: group.h, scale: box.width / group.w, moved: false };
      event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
      onResize(group.id, { w: group.w, h: group.h }, edge, "start");
    }}
    onPointerMove={event => resize(event, edge)} onPointerUp={event => resize(event, edge, true)}
    onPointerCancel={event => {
      event.stopPropagation();
      if (drag.current) onResize(group.id, { w: drag.current.w, h: drag.current.h }, edge, "cancel");
      drag.current = null;
    }} onKeyDown={event => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault(); event.stopPropagation();
        onResize(group.id, { w: drag.current.w, h: drag.current.h }, edge, "cancel"); drag.current = null;
        return;
      }
      const { axis, sign: edgeSign } = EDGES[edge];
      const direction = axis === "w" ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
      const sign = direction[event.key as keyof typeof direction];
      if (!sign) return;
      event.preventDefault(); event.stopPropagation();
      onResize(group.id, { w: group.w, h: group.h }, edge, "start");
      onResize(group.id, { w: group.w, h: group.h, [axis]: group[axis] + sign * edgeSign * step }, edge, "end");
    }} />);
}
