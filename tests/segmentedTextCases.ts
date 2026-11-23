// What the segmented text test renders (segmentedTextScene.tsx): one control per density, each named by it.
import {Density} from '../src/react/density.ts';
export const SEGMENT_DENSITIES=Object.freeze([
 {name:'default'},{name:Density.COMPACT,density:Density.COMPACT},
] as const);
export const SEGMENT_OPTIONS=Object.freeze([{value:'one',label:'One'},{value:'two',label:'Two'}] as const);
