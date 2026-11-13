export interface SkyBounds {left: number; right: number; top: number; bottom: number;}
export interface SkyFigure {name: string; bounds: SkyBounds; path: string; stars: {x: number; y: number}[];}
// A name stays beside its figure. Try the nearest clear slot on each side,
// then prefer less overlap when the strip is too crowded for a clear slot.
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
const overlap = (a: SkyBounds, b: SkyBounds) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

export function namePosition({figure, obstacles, width, height, label, gap, inset}: {figure: SkyBounds;
  obstacles: SkyBounds[]; width: number; height: number; label: {width: number; height: number}; gap: number;
  inset: number}) {
  const top = clamp((figure.top + figure.bottom - label.height) / 2, inset, height - inset - label.height);
  const padded = obstacles.map(box => ({ left: box.left - gap, right: box.right + gap,
    top: box.top - gap, bottom: box.bottom + gap }));
  const candidates = [-1, 1].flatMap(direction => {
    const anchor = direction < 0 ? figure.left - gap - label.width : figure.right + gap;
    const band = { left: direction < 0 ? inset : figure.right, right: direction < 0 ? figure.left : width - inset,
      top, bottom: top + label.height };
    const room = (band.right - band.left) * label.height - padded.reduce((sum, box) => sum + overlap(band, box), 0);
    const starts = [anchor, ...padded.map(box => direction < 0 ? box.left - label.width : box.right)];
    return starts.filter(left => direction < 0 ? left <= anchor : left >= anchor).map(left => {
      left = clamp(left, inset, width - inset - label.width);
      const box = { left, right: left + label.width, top, bottom: top + label.height };
      return { left, top, direction, collision: [...padded, figure].reduce((sum, other) => sum + overlap(box,
        other), 0),
        distance: Math.abs(left - anchor), room };
    });
  });
  candidates.sort((a, b) => a.collision - b.collision || a.distance - b.distance || b.room - a.room);
  return candidates[0];
}
