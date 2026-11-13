import React, { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {BarParticipantElement} from '../actionBarElements.ts';
import {Label} from '../accents.tsx';
import {namePosition, type SkyFigure} from './skyName.ts';

export const NAME_MS = 4000;
const OBSTACLES = `${BarParticipantElement.ACTOR.selector},.theme-moon-button,.theme-moon[data-open] .theme-swatches`;

export function ConstellationName({figure, figures, sky, width, height, onDismiss}: {figure: SkyFigure;
  figures: SkyFigure[]; sky: RefObject<HTMLDivElement>; width: number; height: number; onDismiss(): void}) {
  const label = useRef<HTMLSpanElement>(null), [position,
    setPosition] = useState<ReturnType<typeof namePosition> | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const root = sky.current, text = label.current;
      if (!root || !root.parentElement || !text) throw new Error('Sky label is not mounted');
      const origin = root.getBoundingClientRect();
      // Measuring against the strip works both with native CSS zoom and older
      // WebKit, which reports unscaled rectangles under zoom.
      const scale = origin.width / width;
      const actors = [...root.parentElement.querySelectorAll(OBSTACLES)].map(node => {
        const box = node.getBoundingClientRect();
        return { left: (box.left - origin.left) / scale, right: (box.right - origin.left) / scale,
          top: (box.top - origin.top) / scale, bottom: (box.bottom - origin.top) / scale };
      });
      const style = getComputedStyle(root);
      const next = namePosition({ figure: figure.bounds, obstacles: [
        ...figures.filter(other => other !== figure).map(other => other.bounds), ...actors,
      ], width, height, label: { width: text.offsetWidth, height: text.offsetHeight },
      gap: parseFloat(style.getPropertyValue('--sky-name-gap')),
        inset: parseFloat(style.getPropertyValue('--sky-inset')) });
      if (next.collision) onDismiss(); else setPosition(next);
    };
    const observer = new ResizeObserver(place);
    const fan = new MutationObserver(place);
    if (!label.current || !sky.current) throw new Error('Sky label is not mounted');
    observer.observe(label.current);
    fan.observe(sky.current, { subtree: true, attributes: true, attributeFilter: ['data-open', 'data-side'] });
    place();
    return () => { observer.disconnect(); fan.disconnect(); };
  }, [figure, figures, sky, width, height, onDismiss]);
  return <span ref={label} className="sky-name" role="status" data-side={position && position.direction < 0 ? 'left'
    : 'right'}
    style={{ visibility: position ? undefined : 'hidden', left: position?.left, top: position?.top,
      '--name-from': position ? -position.direction : 0, '--name-duration': `${NAME_MS}ms` }}><Label
        kind="action">{figure.name}</Label></span>;
}
