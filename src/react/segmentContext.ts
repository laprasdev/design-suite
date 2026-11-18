import {createContext} from 'react';
import type {Density} from './density.ts';

// What a surface asks of the segmented controls inside it. A control's own props still win.
export interface SegmentDefaults {variant?: string;tabs?: boolean;scroll?: boolean;density?: Density;}
export const SegmentDefaultsContext=createContext<SegmentDefaults>({});
