import {memo, useLayoutEffect, useRef} from 'react';
import {RecordRows} from './RecordRows.tsx';
import {useTableWindow} from './useTableWindow.ts';
import type {RecordTableProps, TableRecord} from './recordTableTypes.ts';
export type {RecordColumn, RecordIdentity, RecordTableProps, RecordRowsProps, ColumnGroup,
  RowState, RowWindow, TableRecord, TableSort} from './recordTableTypes.ts';

/** Core table presentation. Identity, columns, sorting and domain labels are supplied by its consumer. */
function RecordTableContent<R extends TableRecord, V>({records, columns, groups, windowed = false,
  bounded = false, flat = false, edgeToEdge = false, comparison = false, className = '', label, loading, empty,
  ...table}: RecordTableProps<R, V>) {
  const frame = useRef<HTMLDivElement>(null), body = useRef<HTMLTableSectionElement>(null);
  useLayoutEffect(() => {if (windowed && frame.current) frame.current.scrollTop = 0;}, [records, windowed]);
  const window = useTableWindow(frame, body, windowed, records.length);
  const rows = {...table, label, records, columns, window};
  return <div className={`draft-stats-panel ${className}`} data-record-table data-bounded={bounded || undefined}
    data-flat={flat || undefined} data-edge-to-edge={edgeToEdge || undefined} data-comparison={comparison || undefined}>
    <div ref={frame} className="match-table-wrap draft-stats-scroll" tabIndex={0}
      aria-label={label} aria-busy={!!loading}>
      {groups ? <div className="player-table-groups">
        <RecordRows {...rows} bodyRef={body}/>
        {groups.map(group => <RecordRows key={group.key} {...rows} columns={group.columns}
          identity={undefined} rowActions={undefined} group={group.key}/>)}
      </div> : <RecordRows {...rows} bodyRef={body}/>}
      {loading ? <div className="player-table-loading">{loading}</div> : !records.length && empty}
    </div>
  </div>;
}
export const RecordTable = memo(RecordTableContent) as typeof RecordTableContent;
