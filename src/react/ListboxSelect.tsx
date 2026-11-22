import {Button} from './Button.tsx';
import {Modal} from './Modal.tsx';
import {ModalPlacement} from './modalElements.ts';
import {Label} from './accents.tsx';
import {ApplicationElement} from './applicationElements.ts';
import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useAnchoredPopover} from './useAnchoredPopover.ts';
import {SearchField} from './SearchField.tsx';
import {Density} from './density.ts';
import {searchCopy} from './interfaceCopy.ts';
import {LISTBOX_FORM_ROLES,ListboxElement,ListboxForm} from './listboxSelectElements.ts';
import {LISTBOX_ARROWS,LISTBOX_MOVES,LISTBOX_OPENS,typesText,typeahead,searching,typeaheadMatch,matchesOption,type TypeaheadSearch} from './listboxNavigation.ts';

// The app's own select: a trigger and, when open, a listbox popover of `options`
// (a searchable label, optional leading/trailing content and hover title) anchored
// to it, below it or, with `above`, above it. The trigger
// shows the chosen option as a field unless `children` draw it; with `field`,
// `children` are drawn inside the field (a portrait beside a name, or a menu's name). It follows the
// select-only combobox pattern (listboxNavigation): focus stays on the trigger;
// arrows, Home and End move through the options, typing jumps to a label, Enter
// or Space chooses and Tab closes. A click chooses. The popover is an anchored
// Modal on the trigger, which closes it on Escape and on a press elsewhere.
// `searchSubject` adds a search over the labels. The select form's `onChange` runs when the
// chosen value changes. The menu form is a menu button over actions with no current value:
// `children` draw its trigger, focus moves into the menu while it is open, and `onAction`
// runs the chosen action each time; Escape or a choice returns focus.
export interface ListboxOption<V> {
 value: V;
 label: string;
 description?: ReactNode;
 leading?: ReactNode;
 trailing?: ReactNode;
 title?: string;
 searchText?: string;
}
interface ListboxProps<V extends string|number> {
 options: readonly ListboxOption<V>[];
 label: string;
 field?: boolean;
 title?: string;
 disabled?: boolean;
 above?: boolean;
 className?: string;
 iconOnly?: boolean;
 renderOption?(option: ListboxOption<V>): ReactNode;
}
interface ListboxSelectForm<V extends string|number> extends ListboxProps<V> {
 form?: typeof ListboxForm.SELECT;
 value: V|null|undefined;
 onChange(value: NoInfer<V>): void;
 onAction?: never;
 onCreate?(name: string): void;
 children?: ReactNode;
 searchSubject?: string;
 searchSize?: number;
}
interface ListboxMenuForm<V extends string|number> extends ListboxProps<V> {
 form: typeof ListboxForm.MENU;
 children: ReactNode;
 onAction(value: NoInfer<V>): void;
 value?: never;
 onChange?: never;
 onCreate?: never;
 searchSubject?: never;
 searchSize?: never;
}
export type ListboxSelectProps<V extends string|number>=ListboxSelectForm<V>|ListboxMenuForm<V>;
export function ListboxSelect<V extends string|number>(props: ListboxSelectProps<V>) {
 const {form=ListboxForm.SELECT,options,value,label,title,disabled=false,above=false,field=false,className='',children,
  searchSubject,searchSize,iconOnly=false,renderOption,onCreate}=props;
 // The select reports a changed value; the menu, which holds none, runs every chosen action.
 const run=props.form===ListboxForm.MENU?props.onAction:props.onChange;
 const roles=LISTBOX_FORM_ROLES[form];
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
 // Modal's dismissal returns focus itself; `close` returns it for the closes Modal does not see.
 const settle=()=>{setOpen(false);setQuery('');};
 const close=()=>{settle();trigger.current?.focus();};
 const create=()=>{const name=query.trim();if(!name||!onCreate)return;close();onCreate(name);};
 const choose=(index: number)=>{if(!shown[index])return;close();if(shown[index].value!==value)run(shown[index].value);};
 const find=(key: string,from: number)=>{search.current=typeahead(search.current,key,Date.now());return typeaheadMatch(labels,search.current.text,from);};
 const closedKey=(e: KeyboardEvent)=>{
  if(!searchSubject&&typesText(e)&&e.key!==' '){e.preventDefault();show(find(e.key,start)??start);return;}
  if(!LISTBOX_OPENS[e.key])return;
  e.preventDefault();show(LISTBOX_OPENS[e.key](start,shown.length));
 };
 const openKey=(e: KeyboardEvent)=>{
  if(e.key==='Tab'){close();return;}
  if(LISTBOX_MOVES[e.key]&&(!searchSubject||LISTBOX_ARROWS.includes(e.key))){e.preventDefault();setActive(LISTBOX_MOVES[e.key](active,shown.length));return;}
  if(!searchSubject&&typesText(e)&&(e.key!==' '||searching(search.current,Date.now()))){e.preventDefault();const found=find(e.key,active);if(found!==undefined)setActive(found);return;}
  if(e.key==='Enter'&&!shown.length&&onCreate){e.preventDefault();create();return;}
  if(e.key==='Enter'||!searchSubject&&e.key===' '){e.preventDefault();choose(active);}
 };
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 // Clicking a button does not focus it in every browser. Keep keyboard events
 // on the combobox, its search input or the menu, without moving the anchored viewport.
 const keys=searchSubject?input:{trigger,list}[roles.focus],activeOn=open&&!searchSubject&&shown.length?roles.focus:null;
 useLayoutEffect(()=>{if(open)keys.current?.focus({preventScroll:true});},[open,keys]);
 useLayoutEffect(()=>{if(open)list.current?.children[active]?.scrollIntoView({block:'nearest'});},[open,active,query]);
 return <>
  <button ref={trigger} type="button" role={roles.trigger} className={`${ListboxElement.TRIGGER.className}${className?` ${className}`:''}`} data-shows-value={children===undefined||field||undefined}
   aria-label={label} title={title} aria-haspopup={roles.popup} aria-expanded={open} aria-controls={open?listId:undefined}
   aria-activedescendant={activeOn==='trigger'?optionId(active):undefined}
   disabled={disabled} onClick={()=>open?setOpen(false):show(start)} onKeyDown={open?openKey:closedKey}>{triggerContent}</button>
  {open&&createPortal(<Modal open placement={ModalPlacement.ANCHORED} anchor={trigger} onClose={settle}
   panelRef={panel} role="presentation" className={ListboxElement.POPOVER.className} data-icon-only={iconOnly||undefined}
   style={position}>
   {searchSubject&&<SearchField density={Density.COMPACT} size={searchSize}
    style={searchSize?{width:`calc(${searchSize}ch + 2 * var(--field-gap))`}:undefined} ref={input}
    subject={searchSubject} value={query} onChange={value=>{setQuery(value);setActive(0);}} role="combobox"
    aria-expanded="true" aria-controls={listId} aria-activedescendant={shown.length?optionId(active):undefined}
    onKeyDown={openKey}/>}
   <ul ref={list} id={listId} role={roles.popup} aria-label={label} className={ListboxElement.LIST.className}
    tabIndex={roles.focus==='list'?-1:undefined} aria-activedescendant={activeOn==='list'?optionId(active):undefined}
    onKeyDown={roles.focus==='list'?openKey:undefined}>
    {shown.map((option,index)=><li key={option.value} id={optionId(index)} role={roles.item} aria-label={option.label}
     title={option.title??(iconOnly?option.label:undefined)}
     aria-selected={roles.holdsValue?option.value===value:undefined} data-active={index===active||undefined} className={ListboxElement.OPTION.className}
     onMouseDown={e=>e.preventDefault()} onMouseMove={()=>setActive(index)} onClick={()=>choose(index)}>{renderOption?renderOption(option):<span className={ListboxElement.CONTENT.className}>{option.leading}<Label kind="action" className={ListboxElement.LABEL.className}>{option.label}</Label>{option.trailing&&<span className={ListboxElement.IMPACT.className}>{option.trailing}</span>}</span>}{index===active&&option.description&&<small className={ListboxElement.DETAIL.className}>{option.description}</small>}</li>)}
   </ul>
   {onCreate&&query.trim()&&!options.some(option=>option.label.toLocaleLowerCase()===query.trim().toLocaleLowerCase())&&
    <Button onClick={create}>Create {query.trim()}</Button>}
   {!shown.length&&!onCreate&&<span role="status">{searchCopy.empty}</span>}
  </Modal>,trigger.current?.closest(ApplicationElement.ROOT.selector)??document.body)}
 </>;
}
