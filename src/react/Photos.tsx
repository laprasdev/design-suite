// =====================================================
// Photos — layouts for referenced photos.
// PhotoStrip: a row of thumbnail links, each opening its full image — the
// Owner Desk's review shots, any capture an item references.
// PhotoCompare: labeled captures side by side — the native/web evidence pair
// an approval decision reads from.
// Domain-free; the consumer resolves the image addresses.
// =====================================================
import React, {
  useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent,
} from "react";

export interface StripPhoto {
  src: string;
  title?: string;
  href?: string;
  phone?: boolean;
}

export function PhotoStrip({ photos, className = "" }: { photos: readonly StripPhoto[]; className?: string }) {
  if (!photos.length) return null;
  return (
    <div className={`bd-photos${className ? " " + className : ""}`}>
      {photos.map(p => (
        <a key={p.src} href={p.href ?? p.src} target="_blank" rel="noreferrer" title={p.title} data-phone={p.phone ? "true" : undefined}>
          <img src={p.src} alt={p.title ?? ""} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

export interface CompareCapture {
  src: string;
  label: string;
  href?: string;
  title?: string;
  // One tile of a horizontal strip of `count` equal tiles, shown alone through StripTile: a review sheet's single view.
  tile?: { readonly index: number; readonly count: number };
}

// INLINE fits an existing review row; ROWS lays captures out in justified rows, each row one height and every capture
// at its own aspect, so no capture is letterboxed, no row leaves a gap, and a tile shows only its view.
export const PhotoCompareForm = Object.freeze({ INLINE: 'inline', ROWS: 'rows' } as const);
export type PhotoCompareForm = (typeof PhotoCompareForm)[keyof typeof PhotoCompareForm];

// The one owner of cropping a single tile out of a horizontal strip of equal tiles. Its box keeps the tile's
// aspect, from the loaded image, so no neighbouring tile shows at any width; --strip-tile-max-height, or a
// comparison's --photo-compare-max-height, caps it through its width rather than its height.
export function StripTile({ src, alt, index, count, onLoad, onError }: {
  src: string; alt: string; index: number; count: number;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: SyntheticEvent<HTMLImageElement>) => void;
}) {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`StripTile ${index} is outside a strip of ${count}`);
  }
  const [strip, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const ratio = strip ? strip.width / count / strip.height : 1;
  const measure = (image: HTMLImageElement | null) => {
    if (!image?.complete || !image.naturalWidth) return;
    const { naturalWidth: width, naturalHeight: height } = image;
    // The ref runs on every render; an unchanged size keeps the same state, so measuring never loops.
    setMeasured(previous => (previous?.width === width && previous.height === height ? previous : { width, height }));
  };
  return (
    <span className="bd-strip-tile" style={{ ["--strip-tile-ratio" as string]: ratio }}>
      <img ref={measure} src={src} alt={alt} loading="lazy" onError={onError}
        onLoad={event => { measure(event.currentTarget); onLoad?.(event); }}
        style={{ position: "absolute", top: 0, left: `${-index * 100}%`, width: `${count * 100}%`, height: "100%",
          maxWidth: "none", maxHeight: "none" }} />
    </span>
  );
}

const captureKey = (c: CompareCapture) => `${c.src}#${c.tile ? c.tile.index : "whole"}`;
// A capture's picture: its tile through StripTile, or the whole image.
function captureImage(capture: CompareCapture, onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void) {
  const alt = capture.title ?? capture.label;
  return capture.tile
    ? <StripTile src={capture.src} alt={alt} index={capture.tile.index} count={capture.tile.count} onLoad={onLoad} />
    : <img src={capture.src} alt={alt} loading="lazy" onLoad={onLoad} />;
}
// A capture's figure, rendered in place so default and inline comparisons keep their plain figure markup.
function captureFigure(capture: CompareCapture, image: ReactNode, style?: CSSProperties) {
  return (
    <figure key={captureKey(capture)} style={style}>
      <a href={capture.href ?? capture.src} target="_blank" rel="noreferrer"
        title={capture.title ?? capture.label}>{image}</a>
      <figcaption className="bd-label bd-label--name">{capture.label}</figcaption>
    </figure>
  );
}
// The row height a ROWS comparison aims for when --photo-compare-row-height doesn't set one, and how much taller
// than that a last row may stand before it joins the row above.
const ROW_HEIGHT = 240;
const LAST_ROW_GROWTH = 1.5;

// Justified rows: captures in order, each row exactly as tall as fills `width` with every capture at its own aspect
// (`ratios`, width over height). A row takes the next capture while that brings its height closer to `target`; a last
// row taller than LAST_ROW_GROWTH times the target joins the row above. A single row stays at most that tall.
export function justifiedRows(ratios: readonly number[], width: number, target: number, gap: number) {
  const height = (start: number, end: number) => {
    let total = 0;
    for (let index = start; index < end; index++) total += ratios[index] ?? 1;
    return (width - gap * (end - start - 1)) / total;
  };
  const distance = (value: number) => Math.abs(Math.log(value / target));
  const rows: { start: number; end: number; height: number }[] = [];
  if (!(width > 0) || !(target > 0)) return rows;
  for (let start = 0; start < ratios.length;) {
    let end = start + 1;
    while (end < ratios.length && distance(height(start, end + 1)) <= distance(height(start, end))) end++;
    rows.push({ start, end, height: height(start, end) });
    start = end;
  }
  const last = rows.at(-1), previous = rows.at(-2);
  if (last && previous && last.height > target * LAST_ROW_GROWTH) {
    rows.pop();
    previous.end = last.end;
    previous.height = height(previous.start, previous.end);
  } else if (last && rows.length === 1) last.height = Math.min(last.height, target * LAST_ROW_GROWTH);
  return rows;
}

// A ROWS comparison: it measures its own width and each capture's loaded aspect, then sizes every figure to its row.
function RowsLayout({ captures, className }: { captures: readonly CompareCapture[]; className: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; target: number; gap: number } | null>(null);
  const [ratios, setRatios] = useState<Readonly<Record<string, number>>>({});
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => {
      const style = getComputedStyle(node);
      // The token is registered as a <length>, so the browser resolves any unit to pixels; anything else is refused.
      const token = style.getPropertyValue("--photo-compare-row-height").trim();
      if (token && !token.endsWith("px")) {
        throw new Error(`--photo-compare-row-height resolved to ${token}, not pixels`);
      }
      const target = token ? parseFloat(token) : ROW_HEIGHT;
      // The fractional width, less a pixel, so rounded figure widths never wrap the row they fill.
      const width = Math.floor(node.getBoundingClientRect().width) - 1;
      const next = { width, target, gap: parseFloat(style.columnGap) || 0 };
      const same = (previous: typeof next | null) =>
        previous?.width === next.width && previous.target === next.target && previous.gap === next.gap;
      setBox(previous => (same(previous) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const aspect = captures.map(capture => ratios[captureKey(capture)] ?? 1);
  const rows = box ? justifiedRows(aspect, box.width, box.target, box.gap) : [];
  const loaded = (capture: CompareCapture) => (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    const ratio = naturalWidth / (capture.tile?.count ?? 1) / naturalHeight, key = captureKey(capture);
    setRatios(previous => (previous[key] === ratio ? previous : { ...previous, [key]: ratio }));
  };
  return (
    <div ref={frame} className={className} data-photo-form={PhotoCompareForm.ROWS}>
      {captures.map((capture, index) => {
        const row = rows.find(candidate => index >= candidate.start && index < candidate.end);
        const style = row ? { width: Math.floor(row.height * (aspect[index] ?? 1)), flex: "none" } : undefined;
        return captureFigure(capture, captureImage(capture, loaded(capture)), style);
      })}
    </div>
  );
}

export function PhotoCompare({ captures, className = "", form }: {
  captures: readonly CompareCapture[]; className?: string; form?: PhotoCompareForm;
}) {
  if (!captures.length) return null;
  const classes = `bd-compare${className ? " " + className : ""}`;
  if (form === PhotoCompareForm.ROWS) return <RowsLayout captures={captures} className={classes} />;
  return (
    <div className={classes} data-photo-form={form}>
      {captures.map(c => captureFigure(c, captureImage(c)))}
    </div>
  );
}
