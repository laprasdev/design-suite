import type {CSSProperties} from 'react';
import type {RecordRowsViewProps, TableRecord, TableSort} from './recordTableTypes.ts';

const ariaSort = (sort: TableSort | undefined, key: string) => sort
  ? sort.key === key ? sort.direction === 'desc' ? 'descending' : 'ascending' : 'none' : undefined;

/** Core's sortable heading, identity column and row callbacks; the caller owns domain values. */
export function RecordRows<R extends TableRecord, V>(props: RecordRowsViewProps<R, V>) {
  const {records, columns, identity, rowActions, window, bodyRef, label, group} = props;
  const count = columns.length + (identity ? 1 : 0) + (rowActions ? 1 : 0);
  const shown = window ? records.slice(window.start, window.end) : records;
  const spacer = (rows: number, height: number) => rows > 0 && <tr className="player-table-spacer" aria-hidden>
    <td colSpan={count} style={{height: rows * height}}/>
  </tr>;
  const dimensions = {'--draft-stat-count': columns.length, '--draft-row-portrait': '30px'} as CSSProperties;
  return <table aria-label={label} className="match-player-table draft-full-stats"
    data-group={group} data-identity={!!identity} data-actions={!!rowActions} style={dimensions}>
    <RecordHead {...props}/>
    <tbody ref={bodyRef}>
      {window && spacer(window.start, window.row)}
      {shown.map(record => <RecordRow key={record.id} {...props} record={record}/>)}
      {window && spacer(records.length - window.end, window.row)}
    </tbody>
  </table>;
}
function RecordHead<R extends TableRecord, V>({
  identity, columns, rowActions, actionsLabel, sort, onSort, sortHelp, group, statRole,
}: RecordRowsViewProps<R, V>) {
  const heading = <span className="player-table-heading">{identity?.label}</span>;
  return <thead><tr>
    {identity && <th className="draft-player-sticky"
      aria-sort={identity.sortKey ? ariaSort(sort, identity.sortKey) : undefined}>
      <span className="draft-player-head">
        {onSort && identity.sortKey ? <button onClick={() => onSort(identity.sortKey!)}>{heading}</button> : heading}
        {identity.heading}
      </span>
    </th>}
    {rowActions && <th className="draft-action-sticky"><span className="ui-visually-hidden">{actionsLabel}</span></th>}
    {columns.map(column => <th key={column.key} style={{textAlign: column.align}}
      data-role={group ?? statRole} data-kind={column.kind}
      aria-sort={column.sortable === false ? undefined : ariaSort(sort, column.key)}>
      {column.sortable === false || !onSort ? <span title={column.help}>{column.label}</span>
        : <button onClick={() => onSort(column.key)} title={[column.help, sortHelp].filter(Boolean).join(' ')}>
          {column.label}
        </button>}
    </th>)}
  </tr></thead>;
}
function RecordRow<R extends TableRecord, V>({record, identity, columns, values, rowState, rowActions, rowProps}:
  RecordRowsViewProps<R, V> & {record: R}) {
  const state = rowState?.(record);
  return <tr {...rowProps?.(record)} data-record={record.id} data-selected={state?.selected} data-taken={state?.taken}>
    {identity && <td className="draft-player-sticky">{identity.render(record)}</td>}
    {rowActions && <td className="draft-action-sticky">{rowActions(record)}</td>}
    {columns.map(column => <td key={column.key} style={{textAlign: column.align}}
      className={`draft-stat draft-stat-${column.key}`} data-kind={column.kind}
      data-changed={column.changed?.(record)} title={column.help}>
      {column.value(record, values[record.id])}
    </td>)}
  </tr>;
}
