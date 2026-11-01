// =====================================================
// MonthGrid — a generic month calendar. Renders weekday headers and a grid of
// day cells, calling `renderDay(iso, { day, inMonth, weekday })` for each cell's
// content. Domain-free: the consumer decides what goes in a day (a game chip, a
// dot, nothing). `month` is 1–12.
//
// Pass `onSelect(iso)` to make the month's days selectable: the grid then draws
// each day's number as its select button (keyboard and screen readers), clicking
// anywhere in a day selects it, and `selected` (an iso date) marks the chosen day.
// Controls the consumer renders in a day keep their own actions.
// =====================================================
import React, { useLayoutEffect,useRef,type ReactNode } from "react";

// A day cell: its iso date and date, its day of the month and week, and whether
// it falls in the shown month.
export interface DayCell {
  iso: string;
  date: Date;
  day: number;
  weekday: number;
  inMonth: boolean;
}
export interface MonthGridProps {
  year: number;
  month: number;
  label?: ReactNode;
  weekdays?: readonly ReactNode[];
  renderDay(iso: string, cell: DayCell): ReactNode;
  className?: string;
  fit?: boolean;
  selected?: string | null;
  onSelect?: (iso: string) => void;
}

const DEFAULT_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const fullDate = (c: DayCell) =>
  c.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

function DayNumber({ cell, selected }: { cell: DayCell; selected: boolean }) {
  if (!cell.inMonth) return <span className="bd-day-num">{cell.day}</span>;
  return (
    <button type="button" className="bd-day-num" aria-pressed={selected} aria-label={fullDate(cell)}>
      {cell.day}
    </button>
  );
}

export function MonthGrid({
  year,
  month,
  label,
  weekdays = DEFAULT_WEEKDAYS,
  renderDay,
  className = "",
  fit = false,
  selected,
  onSelect,
}: MonthGridProps) {
  const frame=useRef<HTMLDivElement>(null),calendar=useRef<HTMLDivElement>(null),days=useRef<HTMLDivElement>(null);
  const startWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const gridStart = new Date(year, month - 1, 1 - startWeekday);
  const total = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const cells: DayCell[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      iso: iso(d),
      date: d,
      day: d.getDate(),
      weekday: d.getDay(),
      inMonth: d.getMonth() === month - 1,
    });
  }

  useLayoutEffect(()=>{
    if(!fit)return;
    const outer=frame.current!,monthNode=calendar.current!,grid=days.current!;
    const headings=[...monthNode.children].filter(node=>node!==grid) as HTMLElement[];
    const measure=()=>{
      const gap=parseFloat(getComputedStyle(grid).gap),rows=total/7;
      const available=outer.clientHeight-headings.reduce((sum,node)=>sum+node.offsetHeight,0);
      const cell=Math.max(0,Math.min((outer.clientWidth-gap*6)/7,(available-gap*(rows-1))/rows));
      monthNode.style.width=`${cell*7+gap*6}px`;
      monthNode.style.setProperty('--month-cell-size',`${cell}px`);
    };
    let pending=0;
    const observer=new ResizeObserver(()=>{cancelAnimationFrame(pending);pending=requestAnimationFrame(measure);});
    observer.observe(outer);headings.forEach(node=>observer.observe(node));measure();
    return()=>{cancelAnimationFrame(pending);observer.disconnect();};
  },[fit,total]);

  const monthNode=(
    <div ref={calendar} className={`bd-month${className ? " " + className : ""}`} data-fit={fit||undefined}>
      {label && <div className="bd-month-label">{label}</div>}
      <div className="bd-week-head">
        {weekdays.map((w, i) => (
          <div key={i} className="bd-weekday">
            {w}
          </div>
        ))}
      </div>
      <div ref={days} className="bd-days">
        {cells.map((c) => {
          const select = c.inMonth ? onSelect : undefined;
          return (
            <div
              key={c.iso}
              className={`bd-day${c.inMonth ? "" : " bd-day--out"}${select ? " bd-day--selectable" : ""}`}
              data-selected={select && selected === c.iso ? true : undefined}
              data-date={c.iso}
              onClick={select ? () => select(c.iso) : undefined}
            >
              {onSelect && <DayNumber cell={c} selected={selected === c.iso} />}
              {renderDay(c.iso, c)}
            </div>
          );
        })}
      </div>
    </div>
  );
  return fit?<div ref={frame} className="bd-month-frame">{monthNode}</div>:monthNode;
}
