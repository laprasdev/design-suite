import type {ReactNode} from 'react';

// An option of ListboxSelect.
export interface ListboxOption<V> {
 value: V;
 label: string;
 description?: ReactNode;
 leading?: ReactNode;
 trailing?: ReactNode;
 title?: string;
 searchText?: string;
}
