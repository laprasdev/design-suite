export function SelectionMark({selected}: {selected: boolean}) {
 return <span className="selection-mark" data-selected={selected} aria-hidden="true">{selected?'✓':''}</span>;
}
