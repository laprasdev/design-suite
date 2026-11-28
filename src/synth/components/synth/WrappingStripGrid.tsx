// A strip's grid in its wrap form: the columns it takes in the room it is laid out in, read again whenever that room
// changes. Only a strip that wraps measures its room.
import React, { useRef } from 'react';
import { useRoomSize } from '../../../react/useRoomSize.ts';
import { stripForm, type StripWrap } from './stripColumns.ts';

/** `style` is the strip's grid style; the form sets the columns and the gap. Before it is laid out every cell takes
 *  one row. */
export function WrappingStripGrid({ wrap, style, children }: {
  wrap: StripWrap; style: React.CSSProperties; children: React.ReactNode;
}) {
  const count = React.Children.count(children);
  if (count !== wrap.weights.length)
    throw new Error(`A wrapping strip holds ${count} cells but weighs ${wrap.weights.length}.`);
  const grid = useRef<HTMLDivElement>(null), room = useRoomSize(grid);
  const form = stripForm(room ? room.width : Infinity, wrap);
  return <div ref={grid} data-strip-columns={form.columns}
    style={{ ...style, gridTemplateColumns: form.template, gap: wrap.gap }}>{children}</div>;
}
