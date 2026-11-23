import {Button} from './Button.tsx';
import {Crossfade,CrossfadeForm} from './Crossfade.tsx';
import {Modal} from './Modal.tsx';
import {ModalPlacement} from './modalElements.ts';
import {ListPopoverDefaultsContext,type ListPopoverPlacement} from './listPopoverContext.ts';
import type {Refused} from './refusedKeys.ts';
import {Label} from './accents.tsx';
import {CARET_TURN,CaretGlyph} from './caretGlyph.tsx';
import {HeaderIconButton} from './HeaderIconButton.tsx';
import {useContext,useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {SearchField} from './SearchField.tsx';
import {Opacity} from '../tokens.ts';
import {Density} from './density.ts';
import {searchCopy,stepCopy} from './interfaceCopy.ts';
import {LISTBOX_FORM_ROLES,ListboxElement,ListboxForm} from './listboxSelectElements.ts';
import {
 LISTBOX_ARROWS,LISTBOX_STEP_ARROWS,LISTBOX_MOVES,LISTBOX_OPENS,STEP_MOVES,
 typesText,typeahead,searching,typeaheadMatch,matchesOption,type TypeaheadSearch,
} from './listboxNavigation.ts';

// The app's own select: a trigger and, when open, a listbox popover of `options` anchored to it, below it or where its
// `popover`, or else its surface (ListPopoverDefaultsContext), places it; the list scrolls in its own frame, not the
// popover. The trigger shows the chosen option as a field unless `children` draw it; with `field`, `children`
// are drawn inside the field. In the step form, previous and next carets flank a fixed-width Crossfade carousel slot of
// the options, while `children` (such as a module's title word) and the chosen name both open the list, and arrows on
// the closed trigger step it. An `unavailable` option draws faded and refuses a choice via `onRefuse`.
const STEPS=Object.freeze([
 {key:LISTBOX_STEP_ARROWS.back,turn:CARET_TURN.left,label:stepCopy.previous},
 {key:LISTBOX_STEP_ARROWS.next,turn:CARET_TURN.right,label:stepCopy.next},
] as const);

export interface ListboxOption<V> {
 value: V;
 label: string;
 description?: ReactNode;
 leading?: ReactNode;
 trailing?: ReactNode;
 title?: string;
 searchText?: string;
 unavailable?: string;
}
interface ListboxProps<V extends string|number> {
 options: readonly ListboxOption<V>[];
 label: string;
 field?: boolean;
 title?: string;
 disabled?: boolean;
 popover?: ListPopoverPlacement;
 className?: string;
 iconOnly?: boolean;
 renderOption?(option: ListboxOption<V>): ReactNode;
 onRefuse?(option: ListboxOption<V>): void;
}
// What only the select and step forms take: the value they hold, its change, its creating and its search.
interface ListboxSelectOnly<V extends string|number> {
 value: V|null|undefined;
 onChange(value: NoInfer<V>): void;
 onCreate?(name: string): void;
 searchSubject?: string;
 searchSize?: number;
}
// What only the menu form takes: the action it runs.
interface ListboxMenuOnly<V extends string|number> {onAction(value: NoInfer<V>): void}
type ListboxSelectForm<V extends string|number>=ListboxProps<V>&ListboxSelectOnly<V>&Refused<ListboxMenuOnly<V>>&{
 form?: typeof ListboxForm.SELECT|typeof ListboxForm.STEP;
 children?: ReactNode;
};
type ListboxMenuForm<V extends string|number>=ListboxProps<V>&ListboxMenuOnly<V>&Refused<ListboxSelectOnly<V>>&{
 form: typeof ListboxForm.MENU;
 children: Exclude<ReactNode,undefined>;
};
export type ListboxSelectProps<V extends string|number>=ListboxSelectForm<V>|ListboxMenuForm<V>;

export function ListboxSelect<V extends string|number>(props: ListboxSelectProps<V>) {
 const {form=ListboxForm.SELECT,options,value,label,title,disabled=false,popover,field=false,className='',children,
  searchSubject,searchSize,iconOnly=false,renderOption,onCreate,onRefuse}=props;
 const refused=options.find(option=>option.unavailable!==undefined);
 if(refused&&!onRefuse)throw new Error(`${label} offers ${refused.label}, unavailable, with no onRefuse to say why.`);
 const surface=useContext(ListPopoverDefaultsContext);
 // The select reports a changed value; the menu, which holds none, runs every chosen action.
 const run=props.form===ListboxForm.MENU?props.onAction:props.onChange;
 const roles=LISTBOX_FORM_ROLES[form],isStep=form===ListboxForm.STEP;
 const id=useId(),listId=`${id}-list`,optionId=(index: number)=>`${id}-option-${index}`;
 const trigger=useRef<HTMLButtonElement>(null),stepGroup=useRef<HTMLSpanElement>(null);
 const input=useRef<HTMLInputElement>(null),search=useRef<TypeaheadSearch>({text:'',at:0});
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[query,setQuery]=useState('');
 const [list,setList]=useState<HTMLUListElement|null>(null);
 const shown=searchSubject?options.filter(option=>matchesOption(option.searchText??option.label,query)):options;
 const labels=shown.map(option=>option.label);
 const chosen=roles.holdsValue?shown.findIndex(option=>option.value===value):-1,start=Math.max(0,chosen);
 const show=(index: number)=>{setActive(index);setOpen(true);};
 const toggle=()=>{if(!disabled)(open?setOpen(false):show(start));};
 const selectedContent=children??(roles.holdsValue?options.find(option=>option.value===value)?.label:undefined);
 const triggerContent=!isStep&&(typeof selectedContent==='string'||typeof selectedContent==='number')
  ? <Label kind="action">{selectedContent}</Label> : selectedContent;
 const settle=()=>{setOpen(false);setQuery('');};
 const close=()=>{settle();trigger.current?.focus();};
 const create=()=>{const name=query.trim();if(!name||!onCreate)return;close();onCreate(name);};
 const choose=(index: number)=>{
  const option=shown[index];
  if(!option)return;
  close();
  if(option.unavailable!==undefined){onRefuse?.(option);return;}
  if(!roles.holdsValue||option.value!==value)run(option.value);
 };
 const find=(key: string,from: number)=>{
  search.current=typeahead(search.current,key,Date.now());
  return typeaheadMatch(labels,search.current.text,from);
 };
 const closedKey=(e: KeyboardEvent)=>{
  if(!searchSubject&&typesText(e)&&e.key!==' '){e.preventDefault();show(find(e.key,start)??start);return;}
  if(roles.closedArrowsStep&&STEP_MOVES[e.key]){
   e.preventDefault();choose(STEP_MOVES[e.key](start,shown.length));return;
  }
  if(!LISTBOX_OPENS[e.key])return;
  e.preventDefault();show(LISTBOX_OPENS[e.key](start,shown.length));
 };
 const openKey=(e: KeyboardEvent)=>{
  if(e.key==='Tab'){close();return;}
  if(LISTBOX_MOVES[e.key]&&(!searchSubject||LISTBOX_ARROWS.includes(e.key))){
   e.preventDefault();setActive(LISTBOX_MOVES[e.key](active,shown.length));return;
  }
  if(!searchSubject&&typesText(e)&&(e.key!==' '||searching(search.current,Date.now()))){
   e.preventDefault();const found=find(e.key,active);if(found!==undefined)setActive(found);return;
  }
  if(e.key==='Enter'&&!shown.length&&onCreate){e.preventDefault();create();return;}
  if(e.key==='Enter'||!searchSubject&&e.key===' '){e.preventDefault();choose(active);}
 };
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 const activeOn=open&&!searchSubject&&shown.length?roles.focus:null;
 useLayoutEffect(()=>{if(list)(searchSubject?input.current:{trigger:trigger.current,list}[roles.focus])
  ?.focus({preventScroll:true});},[list,searchSubject,roles.focus]);
 useLayoutEffect(()=>{list?.children[active]?.scrollIntoView({block:'nearest'});},[list,active,query]);
 const triggerClass=`${ListboxElement.TRIGGER.className}${className?` ${className}`:''}`;
 const renderTrigger=(content: ReactNode,shows: boolean)=>(
  <button ref={trigger} type="button" role={roles.trigger} className={triggerClass} data-shows-value={shows||undefined}
   aria-label={label} title={title} aria-haspopup={roles.popup} aria-expanded={open}
   aria-controls={open?listId:undefined} aria-activedescendant={activeOn==='trigger'?optionId(active):undefined}
   disabled={disabled} onClick={toggle} onKeyDown={open?openKey:closedKey}>{content}</button>
 );
 const stepCaret=({key,turn,label: stepLabel}: typeof STEPS[number])=>{
  const to=STEP_MOVES[key](start,shown.length);
  return <HeaderIconButton key={key} label={stepLabel(label)} bare density={Density.COMPACT}
   className={ListboxElement.STEP.className} disabled={disabled||to===start} onClick={()=>choose(to)}>
   <CaretGlyph turn={turn}/></HeaderIconButton>;
 };
 const carousel=isStep&&shown.length>0?<Crossfade form={CrossfadeForm.CAROUSEL}
  activeKey={String(shown[start].value)}
  views={shown.map(option=>({key:String(option.value),node:<Label kind="chosen">{option.label}</Label>}))}/>:null;
 const [backStep,nextStep]=STEPS;
 const searchStyle=searchSize?{width:`calc(${searchSize}ch + 2 * var(--field-gap))`}:undefined;
 const trimmed=query.trim(),canCreate=onCreate&&trimmed
  &&!options.some(option=>option.label.toLocaleLowerCase()===trimmed.toLocaleLowerCase());
 return <>
  {isStep
   ? <span ref={stepGroup} className={ListboxElement.GROUP.className}>
    {children!==undefined&&renderTrigger(children,field)}
    <span className={ListboxElement.STEPPER.className}>
     {stepCaret(backStep)}
     {children!==undefined
      ? <button type="button" tabIndex={-1} className={ListboxElement.CHOSEN.className} disabled={disabled}
       onClick={toggle}>{carousel}</button>
      : renderTrigger(carousel,field)}
     {stepCaret(nextStep)}
    </span>
   </span>
   : renderTrigger(triggerContent,children===undefined||field)}
  {open&&<Modal open placement={ModalPlacement.ANCHORED} anchor={isStep?stepGroup:trigger}
   popover={{...surface,...popover,scroll:false}} onClose={settle} role="presentation" className={ListboxElement.POPOVER.className}
   data-icon-only={iconOnly||undefined}>
   {searchSubject&&<SearchField density={Density.COMPACT} size={searchSize} style={searchStyle} ref={input}
    subject={searchSubject} value={query} onChange={next=>{setQuery(next);setActive(0);}} role="combobox"
    aria-expanded="true" aria-controls={listId} aria-activedescendant={shown.length?optionId(active):undefined}
    onKeyDown={openKey}/>}
   <ul ref={setList} id={listId} role={roles.popup} aria-label={label} className={ListboxElement.LIST.className}
    tabIndex={roles.focus==='list'?-1:undefined} aria-activedescendant={activeOn==='list'?optionId(active):undefined}
    onKeyDown={roles.focus==='list'?openKey:undefined}>
    {shown.map((option,index)=>{
     const unavailable=option.unavailable!==undefined;
     return <li key={option.value} id={optionId(index)} role={roles.item} aria-label={option.label}
      title={option.title??(iconOnly?option.label:undefined)}
      aria-selected={roles.holdsValue?option.value===value:undefined} aria-disabled={unavailable||undefined}
      style={unavailable?{opacity:Opacity.low}:undefined} data-active={index===active||undefined}
      className={ListboxElement.OPTION.className} onMouseDown={e=>e.preventDefault()}
      onMouseMove={()=>setActive(index)} onClick={()=>choose(index)}>
      {renderOption?renderOption(option):<span className={ListboxElement.CONTENT.className}>
       {option.leading}<Label kind="action" className={ListboxElement.LABEL.className}>{option.label}</Label>
       {option.trailing&&<span className={ListboxElement.IMPACT.className}>{option.trailing}</span>}
      </span>}
      {index===active&&option.description&&<small className={ListboxElement.DETAIL.className}>
       {option.description}</small>}
     </li>;
    })}
   </ul>
   {canCreate&&<Button onClick={create}>Create {trimmed}</Button>}
   {!shown.length&&!onCreate&&<span role="status">{searchCopy.empty}</span>}
  </Modal>}
 </>;
}
