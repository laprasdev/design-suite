// The page the menu form's test reads in a browser: a ListboxSelect's menu form over MENU_ACTIONS beside its select
// form over the same options and a select searching them, then a Button, in one row. The root counts the actions the
// menu runs and names the last.
import {useState} from 'react';
import {Button} from '../src/react/Button.tsx';
import {ListboxSelect} from '../src/react/ListboxSelect.tsx';
import {ListboxForm} from '../src/react/listboxSelectElements.ts';
import {ACTION_COUNT_ATTRIBUTE,LAST_ACTION_ATTRIBUTE,MENU_ACTIONS,MENU_LABEL,MenuSceneElement,SEARCH_LABEL,
 SEARCH_SUBJECT,SELECT_LABEL} from './listboxMenuCases.ts';
import {renderScene} from './renderScene.tsx';

function Scene() {
 const [run,setRun]=useState({count:0,last:''}),[region,setRegion]=useState<string>(MENU_ACTIONS[0].value);
 return <div className={MenuSceneElement.ROOT.className} style={{display:'flex',gap:12,alignItems:'center',margin:12}}
  {...{[ACTION_COUNT_ATTRIBUTE]:run.count,[LAST_ACTION_ATTRIBUTE]:run.last}}>
  <ListboxSelect form={ListboxForm.MENU} label={MENU_LABEL} options={MENU_ACTIONS} field
   onAction={last=>setRun(({count})=>({count:count+1,last}))}>{MENU_LABEL}</ListboxSelect>
  <ListboxSelect label={SELECT_LABEL} value={region} options={MENU_ACTIONS} onChange={setRegion}/>
  <ListboxSelect label={SEARCH_LABEL} value={region} options={MENU_ACTIONS} onChange={setRegion}
   searchSubject={SEARCH_SUBJECT}/>
  <Button variant="ghost" className={MenuSceneElement.AFTER.className}>After</Button>
 </div>;
}
renderScene(<Scene/>);
