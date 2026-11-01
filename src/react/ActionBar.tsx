import {forwardRef} from 'react';
import {Bar,type BarProps} from './Bar.tsx';
import {ActionBarElement} from './actionBarElements.ts';
import {SegmentDefaultsContext,type SegmentDefaults} from './segmentContext.ts';
import {TEXT_SEGMENT_VARIANT} from './SegmentedControl.tsx';

// A segmented control in an action bar takes the text form. Whether it is a tab or scrolls stays its own choice.
const ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({variant:TEXT_SEGMENT_VARIANT});
const COMPACT_DENSITY='compact';
const COMPACT_ACTION_BAR_SEGMENTS: SegmentDefaults=Object.freeze({...ACTION_BAR_SEGMENTS,density:COMPACT_DENSITY});

// The compact surface shared by page navigation and header feedback.
export const ActionBar=forwardRef<HTMLDivElement,Omit<BarProps,'as'>&{compact?: boolean}>(function ActionBar({className='',compact=false,...props},ref) {
 return <SegmentDefaultsContext.Provider value={compact?COMPACT_ACTION_BAR_SEGMENTS:ACTION_BAR_SEGMENTS}><Bar {...props} ref={ref} className={`${ActionBarElement.className}${className?` ${className}`:''}`}/></SegmentDefaultsContext.Provider>;
});
