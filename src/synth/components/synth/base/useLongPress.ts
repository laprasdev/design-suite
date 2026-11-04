// =====================================================
// USE LONG PRESS - Detects short tap vs long press
// Reusable by any component needing tap/hold distinction
// =====================================================

import { useRef, useState, useCallback } from 'react';
import { LayoutDimensions } from '../../../design/index.ts';

const LONG_PRESS_MS = LayoutDimensions.timing.slow;
// How far a press may travel before it is a drag and not a hold.
const HOLD_SLOP_PX = 4;

interface LongPressCallbacks {
  onShortPress: () => void;
  onLongPress: () => void;
  /** A press that travels past the slop is a drag: it neither holds nor taps. */
  cancelOnMove?: boolean;
}

interface LongPressResult {
  bind: {
    onMouseDown: () => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onPointerMove: (event: { movementX: number; movementY: number }) => void;
  };
  isLongPressing: boolean;
}

export function useLongPress({ onShortPress, onLongPress, cancelOnMove = false }: LongPressCallbacks): LongPressResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const firedRef = useRef(false);
  const travelRef = useRef(0);
  const draggedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const onMouseDown = useCallback(() => {
    firedRef.current = false;
    travelRef.current = 0;
    draggedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      setIsLongPressing(true);
      onLongPress();
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const onMouseUp = useCallback(() => {
    clear();
    if (!firedRef.current && !draggedRef.current) onShortPress();
    setIsLongPressing(false);
  }, [clear, onShortPress]);

  const onMouseLeave = useCallback(() => {
    clear();
    setIsLongPressing(false);
  }, [clear]);

  const onPointerMove = useCallback((event: { movementX: number; movementY: number }) => {
    if (!cancelOnMove || !timerRef.current) return;
    travelRef.current += Math.hypot(event.movementX, event.movementY);
    if (travelRef.current < HOLD_SLOP_PX) return;
    draggedRef.current = true;
    clear();
  }, [cancelOnMove, clear]);

  return { bind: { onMouseDown, onMouseUp, onMouseLeave, onPointerMove }, isLongPressing };
}
