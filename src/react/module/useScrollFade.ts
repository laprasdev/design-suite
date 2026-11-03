// A scroller's ends fade where there's more beyond them, so what it holds runs out instead of meeting a hard edge.
import React, { useLayoutEffect, useState } from 'react';
import { LayoutDimensions } from '../../layout.ts';

const { scrollFade } = LayoutDimensions.moduleGrid;

interface Ends { start: boolean; end: boolean }
const NO_ENDS: Ends = { start: false, end: false };

function endsOf(element: HTMLElement): Ends {
  const start = element.scrollTop > 0;
  const end = Math.ceil(element.scrollTop + element.clientHeight) < element.scrollHeight;
  return { start, end };
}

/** The mask that fades each end with more beyond it, or nothing when neither has. */
function fadeStyle({ start, end }: Ends): React.CSSProperties {
  if (!start && !end) return {};
  const mask = `linear-gradient(180deg, transparent, #000 ${start ? scrollFade : 0}px, `
    + `#000 calc(100% - ${end ? scrollFade : 0}px), transparent)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/** `scroller` is the element that scrolls. Spread `onScroll` and `style` on it. */
export function useScrollFade(scroller: React.RefObject<HTMLElement | null>) {
  const [ends, setEnds] = useState<Ends>(NO_ENDS);
  const read = () => {
    const element = scroller.current;
    const next = element ? endsOf(element) : NO_ENDS;
    setEnds(was => was.start === next.start && was.end === next.end ? was : next);
  };
  // What it holds can change on any render, so its ends are read after each one, and again when it's resized.
  useLayoutEffect(read);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const sized = new ResizeObserver(read);
    sized.observe(element);
    return () => sized.disconnect();
  }, [scroller.current]);
  return { onScroll: read, style: fadeStyle(ends) };
}
