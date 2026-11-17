// What the segmented text test renders (segmentedTextScene.tsx): one control per density, each named by it.
import {MODULE_TEXT_SIZE} from '../src/moduleGridLayout.ts';
export const SEGMENT_DENSITIES=Object.freeze(['default','compact'] as const);
export const SEGMENT_OPTIONS=Object.freeze([{value:'one',label:'One'},{value:'two',label:'Two'}] as const);
// The smallest text any surface draws, in CSS pixels: the owner's floor.
export const TEXT_FLOOR=MODULE_TEXT_SIZE;
