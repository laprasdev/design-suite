import {forwardRef,type ReactNode} from 'react';
import {AlertTriangle,Info} from 'lucide-react';
import {Bar,type BarProps} from './Bar.tsx';
import {Label} from './accents.tsx';
import {Button} from './Button.tsx';
import {ActionBarElement} from './actionBarElements.ts';
import {HeaderNoticesElement} from './pageBarElements.ts';
import {element} from './elementContract.ts';
import {SegmentDefaultsContext,type SegmentDefaults} from './segmentContext.ts';
import {TEXT_SEGMENT_VARIANT} from './SegmentedControl.tsx';

// A segmented control in an action bar takes the text form. Its own props still win.
const ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({variant:TEXT_SEGMENT_VARIANT});
const COMPACT_ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({...ACTION_BAR_SEGMENTS,density:'compact'});
export const ActionNoticeDetailElement=element('action-bar-notice-detail');
export interface ActionBarNotice {
 message: ReactNode;
 tone: 'error'|'info';
 detail?: string;
 action?: {label: string;onClick(): void};
}
export interface ActionBarProps extends Omit<BarProps,'as'> {
 compact?: boolean;
 notice?: ActionBarNotice|null;
}
// Feedback is a second bar that floats below the bar, over what is beneath it, in the suite's header-notices
// container: showing or clearing a notice never moves the content below the bar.
export const ActionBar=forwardRef<HTMLDivElement,ActionBarProps>(function ActionBar({
 className='',compact=false,notice,slots,...props
},ref) {
 return <SegmentDefaultsContext.Provider value={compact?COMPACT_ACTION_BAR_SEGMENTS:ACTION_BAR_SEGMENTS}>
  <Bar {...props} ref={ref} className={`${ActionBarElement.className}${className?` ${className}`:''}`} slots={{
   ...slots,right:<>{slots.right}{notice&&<div className={HeaderNoticesElement.className}>
    <ActionNotice notice={notice}/></div>}</>,
  }}/>
 </SegmentDefaultsContext.Provider>;
});

// What failed in a word or two, then the start of its detail, cut to a few words; the whole detail is the hover hint.
export function ActionNotice({notice}: {notice?: ActionBarNotice|null}) {
 const Icon=notice?.tone==='error'?AlertTriangle:Info;
 return notice?<Bar className="action-bar-notice" data-tone={notice.tone}
   role={notice.tone==='error'?'alert':'status'} title={notice.detail} slots={{
    left:<><Icon size={16} aria-hidden="true"/><Label kind="action">{notice.message}</Label>
     {notice.detail&&<Label kind="action" className={ActionNoticeDetailElement.className}>{notice.detail}</Label>}</>,
    right:notice.action&&<Button variant="subtle" onClick={notice.action.onClick}>{notice.action.label}</Button>,
   }}/>:null;
}
