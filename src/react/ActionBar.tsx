import {forwardRef,type ReactNode} from 'react';
import {AlertTriangle,Info,type LucideProps} from 'lucide-react';
import {Bar,type BarProps} from './Bar.tsx';
import {BAR_FILL_ATTRIBUTE} from './barElements.ts';
import {Label} from './accents.tsx';
import {Button} from './Button.tsx';
import {ActionBarElement,ActionNoticeElement,NoticeIconElement,type NoticeTone} from './actionBarElements.ts';
import {HeaderNoticesElement} from './pageBarElements.ts';
import {SegmentDefaultsContext,type SegmentDefaults} from './segmentContext.ts';
import {TEXT_SEGMENT_VARIANT} from './SegmentedControl.tsx';
import {Density} from './density.ts';

// A segmented control in an action bar takes the text form. Its own props still win.
const ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({variant:TEXT_SEGMENT_VARIANT});
const COMPACT_ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({...ACTION_BAR_SEGMENTS,density:Density.COMPACT});
export interface ActionBarNotice {
 message: ReactNode;
 tone: NoticeTone;
 detail?: string;
 action?: {label: string;onClick(): void};
}
export interface ActionBarProps extends Omit<BarProps,'as'> {
 density?: Density;
 notice?: ActionBarNotice|null;
}
// Feedback is a second bar that floats below the bar, over what is beneath it, in the suite's header-notices
// container: showing or clearing a notice never moves the content below the bar.
export const ActionBar=forwardRef<HTMLDivElement,ActionBarProps>(function ActionBar({
 className='',density,notice,slots,...props
},ref) {
 return <SegmentDefaultsContext.Provider
  value={density===Density.COMPACT?COMPACT_ACTION_BAR_SEGMENTS:ACTION_BAR_SEGMENTS}>
  <Bar {...props} ref={ref} className={`${ActionBarElement.className}${className?` ${className}`:''}`}
   data-density={density} slots={{
   ...slots,right:<>{slots.right}{notice&&<div className={HeaderNoticesElement.className}>
    <ActionNotice notice={notice}/></div>}</>,
  }}/>
 </SegmentDefaultsContext.Provider>;
});

// A notice's tone as its glyph, coloured by the tone: in the notice, or alone on the element a failure marks.
export function NoticeIcon({tone,...props}: LucideProps&{tone: NoticeTone}) {
 const Icon=tone==='error'?AlertTriangle:Info;
 return <Icon {...props} className={NoticeIconElement.className} data-tone={tone} aria-hidden="true"/>;
}

// What failed in a word or two, then the start of its detail, cut to a few words; the whole detail is the hover hint.
export function ActionNotice({notice}: {notice?: ActionBarNotice|null}) {
 return notice?<Bar className={ActionNoticeElement.ROOT.className} data-tone={notice.tone}
   role={notice.tone==='error'?'alert':'status'} title={notice.detail} slots={{
    left:<><NoticeIcon tone={notice.tone} size={16}/><Label kind="action">{notice.message}</Label>
     {notice.detail&&<Label kind="action" className={ActionNoticeElement.DETAIL.className}>{notice.detail}</Label>}</>,
    right:notice.action&&<Button {...{[BAR_FILL_ATTRIBUTE]: true}} variant="subtle" onClick={notice.action.onClick}>
     {notice.action.label}</Button>,
   }}/>:null;
}
