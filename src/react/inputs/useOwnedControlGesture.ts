import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useControlGesture} from '../../synth/components/synth/base/useControlBehavior.ts';

/** A control closes only the Undo gesture it opened, including when its presentation is replaced. */
export function useOwnedControlGesture() {
  const shared = useControlGesture(), active = useRef(false);
  const begin = useCallback(() => {
    if (!active.current) {active.current = true; shared.begin();}
  }, [shared]);
  const end = useCallback(() => {
    if (active.current) {active.current = false; shared.end();}
  }, [shared]);
  useEffect(() => end, [end]);
  return useMemo(() => ({begin, end}), [begin, end]);
}
