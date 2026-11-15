// The page the action bar height test measures in a browser: an ActionBar holding a Button in each slot and a notice
// with a recovery action, the same notice standing alone, a PageFooter with its action, and a Button outside any bar.
import {ActionNotice} from '../src/react/ActionBar.tsx';
import {ActionBar,Button,PageFooter} from '../src/react/index.ts';
import {ACTION_BAR_BUTTONS,FOOTER_ACTION,NOTICE_BUTTONS,NOTICE_MESSAGE,OUTSIDE_BUTTON} from './actionBarHeightCases.ts';
import {renderScene} from './renderScene.tsx';

const ignore=()=>undefined;
const notice=(label: string)=>({message:NOTICE_MESSAGE,tone:'error',action:{label,onClick:ignore}} as const);
renderScene(<>
 <ActionBar notice={notice(NOTICE_BUTTONS.inBar)} slots={{
  left:<Button variant="primary">{ACTION_BAR_BUTTONS.left}</Button>,
  center:<Button>{ACTION_BAR_BUTTONS.center}</Button>,
  right:<Button variant="subtle">{ACTION_BAR_BUTTONS.right}</Button>,
 }}/>
 <ActionNotice notice={notice(NOTICE_BUTTONS.alone)}/>
 <PageFooter action={{label:FOOTER_ACTION}}/>
 <Button>{OUTSIDE_BUTTON}</Button>
</>);
