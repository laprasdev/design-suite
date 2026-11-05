import {forwardRef,type ReactNode} from 'react';
import {AlertTriangle,Info} from 'lucide-react';
import {Bar,type BarProps} from './Bar.tsx';
import {Label} from './accents.tsx';
import {Button} from './Button.tsx';
import {ActionBarElement} from './actionBarElements.ts';
import {SegmentDefaultsContext,type SegmentDefaults} from './segmentContext.ts';
import {TEXT_SEGMENT_VARIANT} from './SegmentedControl.tsx';

// A segmented control in an action bar takes the text form. Its own props still win.
const ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({variant:TEXT_SEGMENT_VARIANT});
const COMPACT_ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({...ACTION_BAR_SEGMENTS,density:'compact'});
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
// Feedback is a second bar below the header, using the same labels, controls and font tokens.
export const ActionBar=forwardRef<HTMLDivElement,ActionBarProps>(function ActionBar({
 className='',compact=false,notice,...props
},ref) {
 const Icon=notice?.tone==='error'?AlertTriangle:Info;
 return <SegmentDefaultsContext.Provider value={compact?COMPACT_ACTION_BAR_SEGMENTS:ACTION_BAR_SEGMENTS}>
  <Bar {...props} ref={ref} className={`${ActionBarElement.className}${className?` ${className}`:''}`}/>
  {notice&&<Bar className="action-bar-notice" data-tone={notice.tone}
   role={notice.tone==='error'?'alert':'status'} title={notice.detail} slots={{
    left:<><Icon size={16} aria-hidden="true"/><Label kind="action">{notice.message}</Label></>,
    right:notice.action&&<Button variant="subtle" onClick={notice.action.onClick}>{notice.action.label}</Button>,
   }}/>}
 </SegmentDefaultsContext.Provider>;
});
