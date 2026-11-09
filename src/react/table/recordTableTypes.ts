import type {CSSProperties, HTMLAttributes, ReactNode, Ref} from 'react';

export interface TableRecord {id: string | number}
export interface TableSort {key: string; direction: 'asc' | 'desc'}
export interface RowWindow {start: number; end: number; row: number}
export interface RecordColumn<R, V> {
  key: string;
  label: ReactNode;
  help?: string;
  value(record: R, values: V): ReactNode;
  kind?: string;
  sortable?: boolean;
  align?: CSSProperties['textAlign'];
  changed?(record: R): boolean | undefined;
}
export interface ColumnGroup<R, V> {key: string; columns: readonly RecordColumn<R, V>[]}
export interface RowState {selected?: boolean; taken?: boolean}
export interface RecordIdentity<R> {
  label: ReactNode;
  sortKey?: string;
  heading?: ReactNode;
  render(record: R): ReactNode;
}
export interface RecordRowsProps<R extends TableRecord, V> {
  records: readonly R[];
  values: Readonly<Record<string, V>>;
  columns: readonly RecordColumn<R, V>[];
  identity?: RecordIdentity<R>;
  statRole?: string;
  sort?: TableSort;
  sortHelp?: string;
  onSort?(key: string): void;
  rowState?(record: R): RowState;
  rowActions?(record: R): ReactNode;
  rowProps?(record: R): HTMLAttributes<HTMLTableRowElement>;
  actionsLabel?: string;
}
export interface RecordRowsViewProps<R extends TableRecord, V> extends RecordRowsProps<R, V> {
  window?: RowWindow | null;
  bodyRef?: Ref<HTMLTableSectionElement>;
  group?: string;
  label?: string;
}
export interface RecordTableProps<R extends TableRecord, V> extends RecordRowsProps<R, V> {
  groups?: readonly ColumnGroup<R, V>[];
  windowed?: boolean;
  bounded?: boolean;
  className?: string;
  label: string;
  loading?: ReactNode;
  empty?: ReactNode;
  flat?: boolean;
  edgeToEdge?: boolean;
  comparison?: boolean;
}
