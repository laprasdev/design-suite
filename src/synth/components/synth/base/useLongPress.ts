// =====================================================
// USE LONG PRESS - Detects short tap vs long press
// Reusable by any component needing tap/hold distinction
// =====================================================

import { useRef, useState, useCallback } from 'react';
import { LayoutDimensions } from '../../../design/index.ts';

const LONG_PRESS_MS = LayoutDimensions.timing.slow;

interface LongPressCallbacks {
  onShortPress: () => void;
  onLongPress: () => void;
}

interface LongPressResult {
  bind: {
    onMouseDown: () => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
  };
  isLongPressing: boolean;
}

export function useLongPress({ onShortPress, onLongPress }: LongPressCallbacks): LongPressResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const onMouseDown = useCallback(() => {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      setIsLongPressing(true);
      onLongPress();
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const onMouseUp = useCallback(() => {
    clear();
    if (!firedRef.current) onShortPress();
    setIsLongPressing(false);
  }, [clear, onShortPress]);

  const onMouseLeave = useCallback(() => {
    clear();
    setIsLongPressing(false);
  }, [clear]);

  return { bind: { onMouseDown, onMouseUp, onMouseLeave }, isLongPressing };
}
