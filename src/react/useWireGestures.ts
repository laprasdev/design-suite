import { useEffect, useRef, useState, type RefObject } from "react";
import { useEscapeCancel } from "./controlCancel.ts";
import { nearestGroupOutlet } from "./groupOutlets.ts";
import { isPanKeyHeld } from "./pageKeys.ts";
import { useDragSession } from "./useDragSession.ts";
import { snapTie } from "./wireGeometry.ts";
import { collectWires, sampleWires, type SweepWire } from "./wireSweep.ts";
import {GRAPH_NODE_ATTRIBUTE, GRAPH_WIRE_ATTRIBUTE,
  type GraphPoint, type GraphGroup, type GroupOutlet, type GroupOutlets,
  type TwistTie, type WireLink} from "./nodeGraphTypes.ts";

const STILL_PX = 4;
type Gesture = { pointer: number; capture: HTMLElement; start: GraphPoint; before: readonly TwistTie[] } &
  ({ kind: "collect"; screen: GraphPoint; moved: boolean; hit?: string;
    points: GraphPoint[]; wires: SweepWire[]; picked: Set<string> } |
    { kind: "tie"; tie: TwistTie } |
    { kind: "outlet"; frame: GraphGroup; outlet: GroupOutlet; outlets: GroupOutlets });

export function useWireGestures(
  surface: RefObject<HTMLDivElement | null>, width: number, links: readonly WireLink[],
  ties: readonly TwistTie[], onChange: ((ties: readonly TwistTie[]) => void) | undefined,
  onCollect: (ids: readonly string[], at: GraphPoint) => void, interactionSurface?: RefObject<HTMLElement | null>,
  outlets: GroupOutlets = {}, onOutletsChange?: (outlets: GroupOutlets) => void,
) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [sweep, setSweep] = useState<readonly GraphPoint[]>([]);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null), suppressClick = useRef(false);
  // Ends the gesture under way where it is, or cancels it; set while the surface listens.
  const finishGesture = useRef<((cancelled: boolean) => void) | null>(null);
  const begin = (next: Gesture) => { gesture.current = next; setDragging(true); };
  // A gesture is a drag: the drag session ends or cancels it, and unmounting cancels it.
  useDragSession(dragging, { end: () => finishGesture.current?.(false), cancel: () => finishGesture.current?.(true) });
  useEffect(() => () => finishGesture.current?.(true), []);
  const shown = selected.filter(id => links.some(link => link.id === id));
  // Escape clears the selected wires, and takes the key only when there were any.
  useEscapeCancel(() => {
    if (!shown.length) return false;
    setSelected([]); return true;
  });
  const point = (event: { clientX: number; clientY: number }): GraphPoint => {
    const box = surface.current!.getBoundingClientRect(), scale = width / box.width;
    return { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
  };
  useEffect(() => {
    const element = interactionSurface?.current ?? surface.current;
    if (!element || (!onChange && !onOutletsChange)) return;
    const start = (event: PointerEvent) => {
      suppressClick.current = false;
      if (!onChange || !event.shiftKey || isPanKeyHeld() || event.button !== 0 ||
        (event.target as Element).closest(`.bd-node,[${GRAPH_NODE_ATTRIBUTE}],button`)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      element.setPointerCapture(event.pointerId);
      const at = point(event);
      begin({ kind: "collect", pointer: event.pointerId, capture: element, start: at, before: ties,
        hit: (event.target as Element).closest<SVGElement>(".bd-edge-hit")
          ?.getAttribute(GRAPH_WIRE_ATTRIBUTE) ?? undefined,
        screen: { x: event.clientX, y: event.clientY }, moved: false, points: [at],
        wires: sampleWires(element), picked: new Set() });
    };
    const collect = (current: Extract<Gesture, { kind: "collect" }>, event: PointerEvent) => {
      const travel = Math.hypot(event.clientX - current.screen.x, event.clientY - current.screen.y);
      if (!current.moved && travel < STILL_PX) return;
      current.moved = true;
      const at = point(event), previous = current.points[current.points.length - 1];
      for (const id of collectWires(current.wires, previous, at)) current.picked.add(id);
      current.points.push(at);
      setSelected([...current.picked]); setSweep([...current.points]);
    };
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current || current.pointer !== event.pointerId) return;
      event.stopImmediatePropagation(); event.preventDefault();
      if (current.kind === "collect") collect(current, event);
      else if (current.kind === "outlet") {
        const outlet = nearestGroupOutlet(current.frame, point(event), current.outlet);
        onOutletsChange?.({ ...current.outlets, [current.frame.id]: outlet });
      } else {
        const at = point(event);
        onChange?.(current.before.map(tie => tie.id === current.tie.id ? { ...tie,
          ...snapTie({ x: current.tie.x + at.x - current.start.x, y: current.tie.y + at.y - current.start.y }),
        } : tie));
      }
    };
    const finish = (cancelled: boolean, event?: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;
      gesture.current = null; setDragging(false);
      if (current.kind === "collect") {
        // Ended with no release, as by Enter, the sweep collects at the last point it reached.
        if (!cancelled) {
          if (event) collect(current, event);
          const reached = current.points[current.points.length - 1];
          if (current.moved && current.picked.size > 1) onCollect([...current.picked], snapTie(reached));
        }
        if (!cancelled && !current.moved && current.hit) {
          const id = current.hit;
          setSelected(was => was.includes(id) ? was.filter(key => key !== id) : [...was, id]);
        }
        suppressClick.current = !cancelled && (current.moved || !!current.hit);
      } else if (cancelled) {
        if (current.kind === "outlet") onOutletsChange?.(current.outlets);
        else onChange?.(current.before);
      }
      setSweep([]);
      if (cancelled || current.kind !== "collect" || current.moved) setSelected([]);
      if (current.capture.hasPointerCapture(current.pointer)) current.capture.releasePointerCapture(current.pointer);
    };
    const end = (event: PointerEvent) => {
      if (!gesture.current || gesture.current.pointer !== event.pointerId) return;
      event.stopImmediatePropagation(); finish(event.type === "pointercancel", event);
    };
    finishGesture.current = finish;
    const click = (event: MouseEvent) => {
      if (!suppressClick.current || event.detail === 0) return;
      suppressClick.current = false; event.stopImmediatePropagation(); event.preventDefault();
    };
    const lost = (event: PointerEvent) => {
      if (gesture.current?.pointer === event.pointerId) finish(true);
    };
    element.addEventListener("lostpointercapture", lost, true);
    element.addEventListener("pointerdown", start, true);
    element.addEventListener("pointermove", move, true);
    element.addEventListener("pointerup", end, true);
    element.addEventListener("pointercancel", end, true);
    element.addEventListener("click", click, true);
    return () => {
      finishGesture.current = null;
      element.removeEventListener("lostpointercapture", lost, true);
      element.removeEventListener("pointerdown", start, true);
      element.removeEventListener("pointermove", move, true);
      element.removeEventListener("pointerup", end, true);
      element.removeEventListener("pointercancel", end, true);
      element.removeEventListener("click", click, true);
    };
  });
  return {
    selected: shown, sweep, clear: () => setSelected([]),
    select: (id: string, add: boolean) => setSelected(was => add
      ? was.includes(id) ? was.filter(key => key !== id) : [...was, id] : [id]),
    startOutlet: (event: React.PointerEvent<HTMLButtonElement>, frame: GraphGroup, outlet: GroupOutlet) => {
      if (event.button !== 0 || isPanKeyHeld()) return;
      event.stopPropagation(); event.preventDefault();
      event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
      begin({ kind: "outlet", pointer: event.pointerId, capture: event.currentTarget,
        start: point(event), before: ties, frame, outlet, outlets });
    },
    startTie: (event: React.PointerEvent<HTMLButtonElement>, tie: TwistTie) => {
      if (event.button !== 0) return;
      event.stopPropagation(); event.preventDefault();
      event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
      begin({ kind: "tie", pointer: event.pointerId, capture: event.currentTarget,
        start: point(event), tie, before: ties });
    },
  };
}
