import {createContext} from 'react';

// What a surface asks of the segmented controls inside it. A control's own props still win.
export interface SegmentDefaults {variant?: string;tabs?: boolean;scroll?: boolean;density?: string;}
export const SegmentDefaultsContext=createContext<SegmentDefaults>({});
