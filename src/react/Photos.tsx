// =====================================================
// Photos — layouts for referenced photos.
// PhotoStrip: a row of thumbnail links, each opening its full image — the
// Owner Desk's review shots, any capture an item references.
// PhotoCompare: labeled captures side by side — the native/web evidence pair
// an approval decision reads from.
// Domain-free; the consumer resolves the image addresses.
// =====================================================
import React from "react";

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
}

export const PhotoCompareForm = Object.freeze({ INLINE: 'inline' } as const);

export function PhotoCompare({ captures, className = "", form }: {
  captures: readonly CompareCapture[]; className?: string; form?: typeof PhotoCompareForm.INLINE;
}) {
  if (!captures.length) return null;
  return (
    <div className={`bd-compare${className ? " " + className : ""}`} data-photo-form={form}>
      {captures.map(c => (
        <figure key={c.src}>
          <a href={c.href ?? c.src} target="_blank" rel="noreferrer" title={c.title ?? c.label}>
            <img src={c.src} alt={c.title ?? c.label} loading="lazy" />
          </a>
          <figcaption className="bd-label bd-label--name">{c.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
