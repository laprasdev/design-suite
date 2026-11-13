// The header's sky, behind the scene's sprites and grass: tonight's constellations over the desk's place as faint
// glowing stick figures, a scatter of tiny stars, and the moon crossing slowly from left to right, fading out at the
// far side and back in at the near one. Clicking a figure says its name for a moment. The moon carries the theme.
import React, { type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {FanSide, ThemeMoon, type ThemeMoonProps} from './ThemeMoon.tsx';
import { CONSTELLATIONS, DOTS } from './stars.ts';
import {horizontal, inStrip, type SkyObserver, type SkyPoint, type SkyPosition} from './skyPosition.ts';
import { ConstellationName, NAME_MS } from './ConstellationName.tsx';

export const MOON_CROSSING_MS = 60 * 60_000;
// The sky turns a quarter of a degree a minute, so it's drawn again each minute.
const SKY_REFRESH_MS = 60_000;
// Pixels kept clear at the top, and above the grass at the bottom, so stars don't sit in the blades.
const SKY_TOP_PX = 2;
const GRASS_CLEAR_PX = 5;

function useNow(every: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), every); return () => clearInterval(timer);
    }, [every]);
  return now;
}

function useSize(ref: RefObject<HTMLDivElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width,
      height: entry.contentRect.height }));
    if (!ref.current) throw new Error('Sky is not mounted');
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return size;
}

// The strip squeezes the whole sky's width into the header but only its lower 75 degrees into the height, so a figure
// placed star by star would be flattened. Instead each keeps its true shape: its stars are drawn around its middle at
// one scale both ways, a figure as tall as this many degrees filling the strip's height.
const FIGURE_SPAN_DEGREES = 45;
const RADIANS = Math.PI / 180;
const turn = (degrees: number) => ((degrees % 360) + 540) % 360 - 180;

// The figures whose middle is in the strip now, in pixels: their lines as one path, their stars, and their middle.
function figuresInSky(place: SkyObserver, date: Date, toPixels: (point: SkyPoint) => SkyPoint, scale: number,
  top: number, floor: number) {
  return CONSTELLATIONS.flatMap(figure => {
    const at = Object.fromEntries(Object.entries(figure.stars).map(([key, [ra, dec]]) => [key, horizontal({ ra,
      dec }, place, date)]));
    const all = Object.values(at);
    const azimuth = Math.atan2(all.reduce((sum, p) => sum + Math.sin(p.azimuth * RADIANS), 0), all.reduce((sum, p) =>
      sum + Math.cos(p.azimuth * RADIANS), 0)) / RADIANS;
    const centre = { azimuth: (azimuth + 360) % 360, altitude: all.reduce((sum, p) => sum + p.altitude,
      0) / all.length };
    const placed = inStrip(centre);
    if (!placed) return [];
    const middle = toPixels(placed), squeeze = Math.cos(centre.altitude * RADIANS);
    const offset = (p: SkyPosition) => ({ x: turn(p.azimuth - centre.azimuth) * squeeze * scale,
      y: (centre.altitude - p.altitude) * scale });
    const offsets = Object.fromEntries(Object.entries(at).map(([key, p]) => [key, offset(p)]));
    const ys = Object.values(offsets).map(p => p.y);
    // Kept between the top of the sky and the grass.
    const y = Math.min(Math.max(middle.y, top - Math.min(...ys)), floor - Math.max(...ys));
    const pixel = (key: string) => ({ x: middle.x + offsets[key].x, y: y + offsets[key].y });
    const segments = figure.lines.flatMap(run => run.slice(1).map((key, i) => [pixel(run[i]), pixel(key)]));
    const stars = Object.keys(at).map(pixel);
    return [{
      name: figure.name, path: segments.map(([a, b]) => `M${a.x} ${a.y}L${b.x} ${b.y}`).join(''), stars,
      bounds: { left: Math.min(...stars.map(p => p.x)), right: Math.max(...stars.map(p => p.x)),
        top: Math.min(...stars.map(p => p.y)), bottom: Math.max(...stars.map(p => p.y)) },
    }];
  });
}

export function HeaderSky({observer, theme}: {observer: SkyObserver; theme: Omit<ThemeMoonProps, "fan" | "onOpen">}) {
  const root = useRef<HTMLDivElement>(null), moon = useRef<HTMLDivElement>(null), { width, height } = useSize(root);
  const now = useNow(SKY_REFRESH_MS);
  const [named, setNamed] = useState<string | null>(null);
  const clearName = useCallback(() => setNamed(null), []);
  useEffect(() => { if (observer.failure) console.error(`The header sky has no stars: ${observer.failure}`); },
    [observer.failure]);
  useEffect(() => { if (!named) return; const timer = setTimeout(() => setNamed(null), NAME_MS); return () =>
    clearTimeout(timer); }, [named]);
  const sky = useMemo(() => {
    if (observer.failure || !width) return { dots: [], figures: [] };
    const floor = height - GRASS_CLEAR_PX, date = new Date(now);
    const toPixels = (p: SkyPoint) => ({ x: p.x * width, y: floor - p.y * (floor - SKY_TOP_PX) });
    const dots = DOTS.flatMap(dot => {
      const p = inStrip(horizontal(dot, observer, date));
      return p ? [{ ...toPixels(p), glow: dot.glow }] : [];
    });
    const scale = (floor - SKY_TOP_PX) / FIGURE_SPAN_DEGREES;
    return { dots, figures: figuresInSky(observer, date, toPixels, scale, SKY_TOP_PX, floor) };
  }, [observer, width, height, now]);
  const shown = sky.figures.find(f => f.name === named);
  // The moon keeps its place in the crossing across reloads: the animation starts as far in as the clock is.
  const [crossingDelay] = useState(() => -(Date.now() % MOON_CROSSING_MS));
  const fan = () => {
    if (!root.current || !moon.current) throw new Error('Sky is not mounted');
    const sky = root.current.getBoundingClientRect(), at = moon.current.getBoundingClientRect();
    return sky.width > 0 && at.left + at.width / 2 < sky.left + sky.width / 2 ? FanSide.RIGHT : FanSide.LEFT;
  };
  return (
    <div className="header-sky" ref={root} style={{ '--sky-width': `${width}px` }}>
      <svg className="sky-stars" width={width} height={height} aria-hidden={!sky.figures.length || undefined}>
        {sky.dots.map((d, i) => <circle key={i} className="sky-dot" cx={d.x} cy={d.y} r={0.4 + d.glow * 0.45}
          style={{ '--dot-glow': d.glow }} />)}
        {sky.figures.map(f => (
          <g key={f.name} className="sky-figure" data-named={f.name === named || undefined} role="button"
            tabIndex={0} aria-label={f.name} onKeyDown={event => {if (event.key === "Enter"
            || event.key === " ") {event.preventDefault(); setNamed(f.name);}}}
            onClick={() => setNamed(was => (was === f.name ? null : f.name))}>
            <path className="sky-figure-lines" d={f.path} />
            {f.stars.map((p, i) => <circle key={i} className="sky-figure-star" cx={p.x} cy={p.y} r={0.9} />)}
            <path className="sky-figure-hit" d={f.path} />
          </g>
        ))}
      </svg>
      {shown && <ConstellationName key={shown.name} figure={shown} figures={sky.figures} sky={root} width={width}
        height={height - GRASS_CLEAR_PX} onDismiss={clearName} />}
      <div className="sky-moon" ref={moon} style={{ '--moon-crossing': `${MOON_CROSSING_MS}ms`,
        animationDelay: `${crossingDelay}ms` }}>
        <ThemeMoon {...theme} fan={fan} onOpen={clearName} />
      </div>
    </div>
  );
}
