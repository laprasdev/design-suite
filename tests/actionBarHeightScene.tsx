// The page the action bar height test measures in a browser, inside page surfaces so a surface, not a Button, sets
// each bar's height: the cases actionBarHeightCases.ts names.
import {ActionNotice} from '../src/react/ActionBar.tsx';
import {NoticeTone} from '../src/react/actionBarElements.ts';
import {ActionBar,Button,Label,ListboxSelect,PageFooter,PageFooterContents} from '../src/react/index.ts';
import {ACTION_BAR_BUTTONS,FLAT_SURFACE,FOOTER_ACTIONS,FOOTER_OPTIONS,FOOTER_SETTINGS,NOTICE_BUTTONS,NOTICE_MESSAGES,
 OUTSIDE_BUTTON} from './actionBarHeightCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
const notice=(label: string)=>
 ({message:NOTICE_MESSAGES.withButton,tone:NoticeTone.ERROR,action:{label,onClick:ignore}} as const);
const [option]=FOOTER_OPTIONS;
const setting=(label: string)=><div className="page-footer-setting">
 <Label kind="action">{label}</Label>
 <ListboxSelect label={label} value={option.value} options={FOOTER_OPTIONS} onChange={ignore}/>
</div>;
renderScene(<><div className="page-surface">
 <ActionBar notice={notice(NOTICE_BUTTONS.inBar)} slots={{
  left:<Button variant="primary">{ACTION_BAR_BUTTONS.left}</Button>,
  center:<Button>{ACTION_BAR_BUTTONS.center}</Button>,
  right:<Button variant="subtle">{ACTION_BAR_BUTTONS.right}</Button>,
 }}/>
 <ActionNotice notice={notice(NOTICE_BUTTONS.alone)}/>
 <ActionNotice notice={{message:NOTICE_MESSAGES.bare,tone:NoticeTone.INFO}}/>
 <PageFooter action={{label:FOOTER_ACTIONS.set}} settings={setting(FOOTER_SETTINGS.PageFooter)}/>
 <Button>{OUTSIDE_BUTTON}</Button>
</div>
<div className="page-surface" style={FLAT_SURFACE}><PageFooter action={{label:FOOTER_ACTIONS.flat}}/></div>
<div className="page-surface"><PageFooterContents settings={setting(FOOTER_SETTINGS.PageFooterContents)}/></div></>);
