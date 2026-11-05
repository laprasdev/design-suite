import {useLayoutEffect, useRef, useState, type RefObject} from 'react';
import type {RowWindow} from './recordTableTypes.ts';

export interface ListViewport {top: number; height: number; row: number}
const OVERSCAN_SCREENS = 1;
/** The existing core windowing contract, shared by tables and lists. */
export function windowedRange(count: number, {top, height, row}: ListViewport) {
  if (!count) return {start: 0, end: 0};
  if (!row) return {start: 0, end: 1};
  const visible = Math.max(1, Math.ceil(height / row)), before = visible * OVERSCAN_SCREENS;
  const offset = Math.max(0, Math.min(top, Math.max(0, count * row - height))), first = Math.floor(offset / row);
  return {start: Math.max(0, first - before), end: Math.min(count, Math.ceil((offset + height) / row) + before)};
}
interface TableView extends ListViewport {offset: number}
const NO_VIEW: TableView = {top: 0, height: 0, offset: 0, row: 0};

export function useTableWindow(frame: RefObject<HTMLDivElement>, body: RefObject<HTMLTableSectionElement>,
  enabled: boolean, count: number): RowWindow | null {
  const [view, setView] = useState(NO_VIEW), requested = useRef(NO_VIEW), measure = useRef(() => {});
  measure.current = () => {
    const node = frame.current, rowsBody = body.current;
    if (!node || !rowsBody || node.getClientRects().length === 0) return;
    const box = node.getBoundingClientRect(), last = requested.current;
    const rows = [...rowsBody.children].filter(row => !row.matches('.player-table-spacer'));
    const height = rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0);
    const row = rows.length ? Math.ceil(height / rows.length) : last.row;
    const next = {top: node.scrollTop, height: node.clientHeight,
      offset: Math.round(rowsBody.getBoundingClientRect().top - box.top + node.scrollTop), row};
    if (JSON.stringify(next) === JSON.stringify(last)) return;
    requested.current = next; setView(next);
  };
  useLayoutEffect(() => {if (enabled) measure.current();});
  useLayoutEffect(() => {
    const node = frame.current;
    if (!enabled || !node) return;
    const update = () => measure.current(), observer = new ResizeObserver(update);
    observer.observe(node); node.addEventListener('scroll', update, {passive: true});
    return () => {observer.disconnect();node.removeEventListener('scroll', update);};
  }, [enabled]);
  return enabled ? {...windowedRange(count, {top: view.top - view.offset, height: view.height, row: view.row}),
    row: view.row} : null;
}
