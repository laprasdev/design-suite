// =====================================================
// USE CONTROL BEHAVIOR - Shared drag/hover logic for interactive controls
// Extracted from Knob.tsx, used by: Knob, MiniKnob, RangeKnob, Boolean, etc.
// =====================================================

import { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';

export const ControlGestureContext = createContext<{ beginGesture: () => void; endGesture: () => void } | null>(null);

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
  const gesture = useContext(ControlGestureContext);
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

  // Calculate sensitivity: custom > integer default > float default
  const sensitivity = customSensitivity ?? (isInteger ? 0.5 : 0.005);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    gesture?.beginGesture();
    setIsDragging(true);
    dragStart.current = {
      pos: vertical ? e.clientY : e.clientX,
      value
    };
    e.preventDefault();
  }, [value, disabled, vertical, gesture]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

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
  }, [isDragging, onChange, min, max, sensitivity, isInteger, value, vertical]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); gesture?.endGesture(); }, [gesture]);

  const cancelDrag = useCallback(() => {
    onChange?.(dragStart.current.value);
    handleMouseUp();
  }, [onChange, handleMouseUp]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') cancelDrag();
    else if (e.key === 'Enter' || e.key === 'Tab') handleMouseUp();
  }, [cancelDrag, handleMouseUp]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleKeyDown]);

  return { isDragging, isHovered, setIsHovered, handleMouseDown };
}

// Alias for backward compatibility
export const useKnobDrag = useControlBehavior;
