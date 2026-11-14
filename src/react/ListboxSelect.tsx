import {Button} from './Button.tsx';
import {Modal} from './Modal.tsx';
import {ModalPlacement} from './modalElements.ts';
import {Label} from './accents.tsx';
import {ApplicationElement} from './applicationElements.ts';
import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useAnchoredPopover} from './useAnchoredPopover.ts';
import {SearchField} from './SearchField.tsx';
import {searchCopy} from './interfaceCopy.ts';
import {ListboxElement} from './listboxSelectElements.ts';
import {LISTBOX_MOVES,LISTBOX_OPENS,typesText,typeahead,searching,typeaheadMatch,matchesOption,type TypeaheadSearch} from './listboxNavigation.ts';

// The app's own select: a trigger and, when open, a listbox popover of `options`
// (a searchable label, optional leading/trailing content and hover title) anchored
// to it, below it or, with `above`, above it. The trigger
// shows the chosen option as a field unless `children` draw it; with `field`,
// `children` draw the chosen option inside the field (a portrait beside a name). It follows the
// select-only combobox pattern (listboxNavigation): focus stays on the trigger;
// arrows, Home and End move through the options, typing jumps to a label, Enter
// or Space chooses and Tab closes. A click chooses. The popover is an anchored
// Modal on the trigger, which closes it on Escape and on a press elsewhere.
// `searchSubject` adds a search over the labels.
export interface ListboxOption<V> {
 value: V;
 label: string;
 description?: ReactNode;
 leading?: ReactNode;
 trailing?: ReactNode;
 title?: string;
 searchText?: string;
}
export interface ListboxSelectProps<V extends string|number> {
 options: readonly ListboxOption<V>[];
 value: V|null|undefined;
 onChange(value: NoInfer<V>): void;
 onCreate?(name: string): void;
 label: string;
 title?: string;
 disabled?: boolean;
 above?: boolean;
 field?: boolean;
 className?: string;
 children?: ReactNode;
 searchSubject?: string;
 searchSize?: number;
 iconOnly?: boolean;
 renderOption?(option: ListboxOption<V>): ReactNode;
}
export function ListboxSelect<V extends string|number>({options,value,onChange,label,title,disabled=false,above=false,field=false,className='',children,searchSubject,searchSize,iconOnly=false,renderOption,onCreate}: ListboxSelectProps<V>) {
 const id=useId(),listId=`${id}-list`,optionId=(index: number)=>`${id}-option-${index}`;
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),list=useRef<HTMLUListElement>(null),input=useRef<HTMLInputElement>(null),search=useRef<TypeaheadSearch>({text:'',at:0});
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[query,setQuery]=useState('');
 const shown=searchSubject?options.filter(option=>matchesOption(option.searchText??option.label,query)):options;
 const position=useAnchoredPopover(open,trigger,panel,{above,scroll:false});
 const labels=shown.map(option=>option.label),chosen=shown.findIndex(option=>option.value===value),start=Math.max(0,chosen);
 const show=(index: number)=>{setActive(index);setOpen(true);};
 const selectedContent=children??options.find(option=>option.value===value)?.label;
 const triggerContent=typeof selectedContent==='string'||typeof selectedContent==='number'
  ? <Label kind="action">{selectedContent}</Label> : selectedContent;
 const create=()=>{
  const name=query.trim();if(!name||!onCreate)return;
  setOpen(false);setQuery('');trigger.current?.focus();onCreate(name);
 };
 const choose=(index: number)=>{if(!shown[index])return;setOpen(false);setQuery('');trigger.current?.focus();if(shown[index].value!==value)onChange(shown[index].value);};
 const find=(key: string,from: number)=>{search.current=typeahead(search.current,key,Date.now());return typeaheadMatch(labels,search.current.text,from);};
 const closedKey=(e: KeyboardEvent)=>{
  if(!searchSubject&&typesText(e)&&e.key!==' '){e.preventDefault();show(find(e.key,start)??start);return;}
  if(!LISTBOX_OPENS[e.key])return;
  e.preventDefault();show(LISTBOX_OPENS[e.key](start,shown.length));
 };
 const openKey=(e: KeyboardEvent)=>{
  if(e.key==='Tab'){trigger.current?.focus();setOpen(false);setQuery('');return;}
  if(LISTBOX_MOVES[e.key]&&(!searchSubject||['ArrowUp','ArrowDown'].includes(e.key))){e.preventDefault();setActive(LISTBOX_MOVES[e.key](active,shown.length));return;}
  if(!searchSubject&&typesText(e)&&(e.key!==' '||searching(search.current,Date.now()))){e.preventDefault();const found=find(e.key,active);if(found!==undefined)setActive(found);return;}
  if(e.key==='Enter'&&!shown.length&&onCreate){e.preventDefault();create();return;}
  if(e.key==='Enter'||!searchSubject&&e.key===' '){e.preventDefault();choose(active);}
 };
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 // Clicking a button does not focus it in every browser. Keep keyboard events
 // on the combobox, or its search input, without moving the anchored viewport.
 useLayoutEffect(()=>{if(open)(searchSubject?input:trigger).current?.focus({preventScroll:true});},[open,searchSubject]);
 useLayoutEffect(()=>{if(open)list.current?.children[active]?.scrollIntoView({block:'nearest'});},[open,active,query]);
 return <>
  <button ref={trigger} type="button" role="combobox" className={`${ListboxElement.TRIGGER.className}${className?` ${className}`:''}`} data-shows-value={children===undefined||field||undefined}
   aria-label={label} title={title} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined} aria-activedescendant={open&&!searchSubject&&shown.length?optionId(active):undefined}
   disabled={disabled} onClick={()=>open?setOpen(false):show(start)} onKeyDown={open?openKey:closedKey}>{triggerContent}</button>
  {open&&createPortal(<Modal open placement={ModalPlacement.ANCHORED} anchor={trigger} onClose={()=>{setOpen(false);setQuery('');}}
   panelRef={panel} role="presentation" className={ListboxElement.POPOVER.className} data-icon-only={iconOnly||undefined}
   style={position}>
   {searchSubject&&<SearchField density="compact" size={searchSize} style={searchSize?{width:`calc(${searchSize}ch + 2 * var(--field-gap))`}:undefined} ref={input} subject={searchSubject} value={query} onChange={value=>{setQuery(value);setActive(0);}} role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={shown.length?optionId(active):undefined} onKeyDown={openKey}/>}
   <ul ref={list} id={listId} role="listbox" aria-label={label} className={ListboxElement.LIST.className}>
    {shown.map((option,index)=><li key={option.value} id={optionId(index)} role="option" aria-label={option.label} title={option.title??(iconOnly?option.label:undefined)} aria-selected={option.value===value} data-active={index===active||undefined} className={ListboxElement.OPTION.className}
     onMouseDown={e=>e.preventDefault()} onMouseMove={()=>setActive(index)} onClick={()=>choose(index)}>{renderOption?renderOption(option):<span className={ListboxElement.CONTENT.className}>{option.leading}<Label kind="action" className={ListboxElement.LABEL.className}>{option.label}</Label>{option.trailing&&<span className={ListboxElement.IMPACT.className}>{option.trailing}</span>}</span>}{index===active&&option.description&&<small className={ListboxElement.DETAIL.className}>{option.description}</small>}</li>)}
   </ul>
   {onCreate&&query.trim()&&!options.some(option=>option.label.toLocaleLowerCase()===query.trim().toLocaleLowerCase())&&
    <Button onClick={create}>Create {query.trim()}</Button>}
   {!shown.length&&!onCreate&&<span role="status">{searchCopy.empty}</span>}
  </Modal>,trigger.current?.closest(ApplicationElement.ROOT.selector)??document.body)}
 </>;
}
