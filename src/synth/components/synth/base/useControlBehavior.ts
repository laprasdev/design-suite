// =====================================================
// USE CONTROL BEHAVIOR - Shared drag/hover logic for interactive controls
// Extracted from Knob.tsx, used by: Knob, MiniKnob, RangeKnob, Boolean, etc.
// =====================================================

import { useState, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import { useDragSession } from '../../../../react/useDragSession.ts';

export const ControlGestureContext = createContext<{ beginGesture: () => void; endGesture: () => void } | null>(null);

export interface ControlGesture { begin: () => void; end: () => void }

/**
 * The one owner of a control's undo gesture: whatever a drag or an edit writes between begin and end undoes in one
 * step. Without a provider, as in the proposals, both do nothing.
 */
export function useControlGesture(): ControlGesture {
  const gesture = useContext(ControlGestureContext);
  return useMemo(() => ({ begin: () => gesture?.beginGesture(), end: () => gesture?.endGesture() }), [gesture]);
}

export interface DragOptions {
  min?: number;
  max?: number;
  sensitivity?: number;
  isInteger?: boolean;
  disabled?: boolean;
  vertical?: boolean; // true = vertical drag (default), false = horizontal
}

export interface DragBehaviorResult {
  isDragging: boolean;
  isHovered: boolean;
  setIsHovered: (v: boolean) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  /** Goes on the same element as handleMouseDown: a mouse event doesn't carry the pointer it would have to capture. */
  handlePointerDown: (e: React.PointerEvent) => void;
}

/**
 * Unified drag behavior hook for knobs, sliders, and other draggable controls.
 * Handles: drag state, hover state, mouse events, window listeners
 */
export function useControlBehavior(
  value: number,
  onChange: ((v: number) => void) | undefined,
  options: DragOptions = {}
): DragBehaviorResult {
  const gesture = useControlGesture();
  const {
    min = 0,
    max = 1,
    sensitivity: customSensitivity,
    isInteger = false,
    disabled = false,
    vertical = true
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStart = useRef({ pos: 0, value: 0 });
  const pressedPointer = useRef<number | null>(null);

  // Calculate sensitivity: custom > integer default > float default
  const sensitivity = customSensitivity ?? (isInteger ? 0.5 : 0.005);

  const handlePointerDown = useCallback((e: React.PointerEvent) => { pressedPointer.current = e.pointerId; }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    gesture.begin();
    setIsDragging(true);
    // A release over a frame, like the Preview, would otherwise never reach this window, and the control would stay grabbed.
    if (pressedPointer.current !== null) e.currentTarget.setPointerCapture(pressedPointer.current);
    dragStart.current = {
      pos: vertical ? e.clientY : e.clientX,
      value
    };
    e.preventDefault();
  }, [value, disabled, vertical, gesture]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); gesture.end(); }, [gesture]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    // No button down means the release went somewhere this window couldn't hear it: the drag is over, and this move writes nothing.
    if (e.buttons === 0) { handleMouseUp(); return; }

    const currentPos = vertical ? e.clientY : e.clientX;
    const delta = vertical
      ? dragStart.current.pos - currentPos  // Vertical: up = increase
      : currentPos - dragStart.current.pos; // Horizontal: right = increase

    let newValue = dragStart.current.value + delta * sensitivity;

    // Clamp and optionally round
    newValue = Math.max(min, Math.min(max, newValue));
    if (isInteger) newValue = Math.round(newValue);

    if (newValue !== value) {
      onChange?.(newValue);
    }
  }, [isDragging, onChange, min, max, sensitivity, isInteger, value, vertical, handleMouseUp]);

  const cancelDrag = useCallback(() => {
    onChange?.(dragStart.current.value);
    handleMouseUp();
  }, [onChange, handleMouseUp]);

  useDragSession(isDragging,
    { move: handleMouseMove, end: handleMouseUp, cancel: cancelDrag, lostFocus: handleMouseUp });

  return { isDragging, isHovered, setIsHovered, handleMouseDown, handlePointerDown };
}

// Alias for backward compatibility
export const useKnobDrag = useControlBehavior;
