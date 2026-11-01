// Keyboard navigation through a listbox of options (ListboxSelect), following
// the select-only combobox pattern.

// Keys typed within this long of each other search the labels together.
export const TYPEAHEAD_MS=500;
// Keys that move through an open list, from the active option: (active,count)=>next.
type ListMove=(active: number,count: number)=>number;
export const LISTBOX_MOVES: Readonly<Record<string,ListMove>>=Object.freeze({ArrowDown:(i,n)=>Math.min(n-1,i+1),ArrowUp:i=>Math.max(0,i-1),Home:()=>0,End:(i,n)=>n-1});
// Keys that open a closed list, and the option each starts on, from the chosen one.
export const LISTBOX_OPENS: Readonly<Record<string,ListMove>>=Object.freeze({ArrowDown:i=>i,ArrowUp:i=>i,Enter:i=>i,' ':i=>i,Home:()=>0,End:(i,n)=>n-1});
// A key that types into the search rather than commanding the list.
export const typesText=(event: Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'>)=>event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
const searchable=(text: string)=>text.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();

// The search after typing `key` at `now`: it continues the previous search while
// keys come within TYPEAHEAD_MS of each other, else starts again.
export interface TypeaheadSearch {
 text: string;
 at: number;
}
export const typeahead=(previous: TypeaheadSearch,key: string,now: number): TypeaheadSearch=>({text:(now-previous.at<TYPEAHEAD_MS?previous.text:'')+searchable(key),at:now});
// Whether a search is still taking keys (a space then searches, not chooses).
export const searching=(search: TypeaheadSearch,now: number)=>!!search.text&&now-search.at<TYPEAHEAD_MS;
// The option a search reaches among `labels`, from the active one (`from`), or
// undefined. Typing one letter again moves to the next label starting with it;
// more letters narrow the search, staying on a label that still matches.
export function typeaheadMatch(labels: readonly string[],text: string,from: number) {
 const repeated=[...text].every(letter=>letter===text[0]),search=repeated?text[0]:text,first=repeated?from+1:from;
 return labels.map((_,i)=>(first+i)%labels.length).find(i=>searchable(labels[i]).startsWith(search));
}

// Substring terms for searchable pickers; case and accents match typeahead.
export const matchesOption=(label: string,query: string)=>searchable(query).trim().split(/\s+/).every(term=>searchable(label).includes(term));
