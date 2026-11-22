// The page the pending test reads in a browser: a live and a pending row of Buttons (each variant, a glyph beside
// text, text with an element in it), SettingBooleans (labelled, icon-only, with detail) and a SegmentedControl whose
// options have detail, saving one in the pending row, a consumer Button that
// sets its own `data-pending`, a form whose only Button submits while pending, a swept SegmentedControl in each
// form saving one option, another option a glyph beside its text, and live tabs with detail and pending tabs, each
// counting its changes.
import {useState, type FormEvent} from 'react';
import {Button} from '../src/react/Button.tsx';
import {TextInput} from '../src/react/inputs/ModuleTextInput.tsx';
import {ICON_SEGMENT_VARIANT,SegmentedControl,TEXT_SEGMENT_VARIANT} from '../src/react/SegmentedControl.tsx';
import {Boolean,BooleanForm} from '../src/synth/components/synth/Boolean.tsx';
import {CHANGE_COUNT_ATTRIBUTE,PendingSceneElement,SEGMENT_OPTIONS,SEGMENT_SAVING,SETTING_LABEL,
 SUBMIT_COUNT_ATTRIBUTE} from './buttonPendingCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
const GLYPH=<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5"
 fill="currentColor"/></svg>;
const SEGMENT_VARIANTS=[TEXT_SEGMENT_VARIANT,ICON_SEGMENT_VARIANT] as const;
const segmentOptions=SEGMENT_OPTIONS.map(({value,label,glyph})=>({value,label:glyph?<>{GLYPH}{label}</>:label}));
const textOptions=SEGMENT_OPTIONS.map(({value,label})=>({value,label}));
const detailOptions=textOptions.map(option=>({...option,detail:'Help'}));

function Row({pending,className}: {pending: boolean,className: string}) {
 const setting={form:BooleanForm.SETTING,value:true,label:SETTING_LABEL,onChange:ignore,pending} as const;
 return <div className={className} style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center',margin:12}}>
  <Button variant="primary" pending={pending}>Save</Button>
  <Button variant="ghost" pending={pending}>Reopen</Button>
  <Button variant="subtle" pending={pending}>Dismiss</Button>
  <Button variant="ghost" pending={pending}>{GLYPH}Add item</Button>
  <Button variant="ghost" pending={pending}>Save <b>now</b></Button>
  <Button variant="ghost" disabled>Disabled</Button>
  <Boolean {...setting}/>
  <Boolean {...setting} iconOnly/>
  <span className={PendingSceneElement.DETAIL.className}><Boolean {...setting} detail="Help"/></span>
  <span className={PendingSceneElement.DETAIL.className}><SegmentedControl ariaLabel="Stage" options={detailOptions}
   value={SEGMENT_OPTIONS[0].value} pending={pending?SEGMENT_SAVING:null} onChange={ignore}/></span>
 </div>;
}

function SubmitForm() {
 const [submits,setSubmits]=useState(0),[name,setName]=useState('');
 const submit=(event: FormEvent)=>{event.preventDefault();setSubmits(count=>count+1);};
 return <form className={PendingSceneElement.FORM.className} {...{[SUBMIT_COUNT_ATTRIBUTE]:submits}} onSubmit={submit}
  style={{display:'flex',gap:12,margin:12}}>
  <TextInput className={PendingSceneElement.FIELD.className} ariaLabel="Name" value={name} onChange={setName}/>
  <Button type="submit" variant="primary" pending className={PendingSceneElement.SUBMIT.className}>Submit</Button>
 </form>;
}

function Tabs({pending,className}: {pending: boolean,className: string}) {
 const [changes,setChanges]=useState(0),[value,setValue]=useState<string>(SEGMENT_OPTIONS[0].value);
 const change=(next: string)=>{setValue(next);setChanges(count=>count+1);};
 return <div className={className} {...{[CHANGE_COUNT_ATTRIBUTE]:changes}} style={{margin:12}}>
  <SegmentedControl ariaLabel="Stage" tabs options={pending?textOptions:detailOptions}
   value={value} pending={pending?SEGMENT_SAVING:null} onChange={change}/>
 </div>;
}

renderScene(<div className="page-surface">
 <Row pending={false} className={PendingSceneElement.LIVE.className}/>
 <Row pending className={PendingSceneElement.PENDING.className}/>
 <div style={{margin:12}}><Button variant="ghost" data-pending={false}
  className={PendingSceneElement.CONSUMER_ATTRIBUTE.className}>Propose time</Button></div>
 <SubmitForm/>
 {SEGMENT_VARIANTS.map(variant=><div key={variant} style={{margin:12}}><SegmentedControl ariaLabel="Stage"
  className={PendingSceneElement.SEGMENT.className} variant={variant} options={segmentOptions} pending={SEGMENT_SAVING}
  onChange={ignore}/></div>)}
 <Tabs pending={false} className={PendingSceneElement.LIVE_TABS.className}/>
 <Tabs pending className={PendingSceneElement.TABS.className}/>
</div>);
