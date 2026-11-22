import {SelectionMarkElement} from './selectionMarkElements.ts';

export function SelectionMark({selected}: {selected: boolean}) {
 return <span className={SelectionMarkElement.className} data-selected={selected} aria-hidden="true">
  {selected?'✓':''}
 </span>;
}
