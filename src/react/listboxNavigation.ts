// Keyboard navigation through a list of options: a listbox (ListboxSelect), following the select-only combobox
// pattern, and a tab list (tabNavigation.ts, for SegmentedControl's `tabs`).

// Keys typed within this long of each other search the labels together.
export const TYPEAHEAD_MS=500;
// Keys that move through an open list, from the active option's index, or NO_ACTIVE: (active,count)=>next.
type ListMove=(active: number,count: number)=>number;
// No option is active (findIndex's none): the arrows enter the list, on at its first option and back at its last.
export const NO_ACTIVE=-1;
// The arrows that step back and on through a list along each orientation.
const LIST_ARROWS=Object.freeze({
 vertical:{back:'ArrowUp',next:'ArrowDown'},
 horizontal:{back:'ArrowLeft',next:'ArrowRight'},
});
export type ListOrientation=keyof typeof LIST_ARROWS;
// The moves along `orientation`: an arrow past an end stops there, or (`wraps`) comes round to the other end.
export function listMoves(orientation: ListOrientation,wraps: boolean): Readonly<Record<string,ListMove>> {
 const {back,next}=LIST_ARROWS[orientation];
 const step=(by: number): ListMove=>(active,n)=>{
  const i=active===NO_ACTIVE&&by<0?n:active;
  return wraps?(i+by+n)%n:Math.min(n-1,Math.max(0,i+by));
 };
 return Object.freeze({[back]:step(-1),[next]:step(1),Home:()=>0,End:(_,n)=>n-1});
}
const LISTBOX_ORIENTATION: ListOrientation='vertical';
export const LISTBOX_MOVES=listMoves(LISTBOX_ORIENTATION,false);
// The arrows that step back and on along a listbox.
export const LISTBOX_STEP_ARROWS=LIST_ARROWS[LISTBOX_ORIENTATION];
// The arrows along a listbox, which a list that is searching still takes.
export const LISTBOX_ARROWS: readonly string[]=Object.freeze([LISTBOX_STEP_ARROWS.back,LISTBOX_STEP_ARROWS.next]);
// Keys that open a closed list, and the option each starts on, from the chosen one.
const onChosen: ListMove=i=>i;
export const LISTBOX_OPENS: Readonly<Record<string,ListMove>>=Object.freeze({
 ...Object.fromEntries([...LISTBOX_ARROWS,'Enter',' '].map(key=>[key,onChosen])),Home:()=>0,End:(_,n)=>n-1});
// A key that types into the search rather than commanding the list.
export const typesText=(event: Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'>)=>
 event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey;
const searchable=(text: string)=>text.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();

// The search after typing `key` at `now`: it continues the previous search while
// keys come within TYPEAHEAD_MS of each other, else starts again.
export interface TypeaheadSearch {
 text: string;
 at: number;
}
export const typeahead=(previous: TypeaheadSearch,key: string,now: number): TypeaheadSearch=>
 ({text:(now-previous.at<TYPEAHEAD_MS?previous.text:'')+searchable(key),at:now});
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
export const matchesOption=(label: string,query: string)=>
 searchable(query).trim().split(/\s+/).every(term=>searchable(label).includes(term));
