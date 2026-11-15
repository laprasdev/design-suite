import {element,type ElementContract} from './elementContract.ts';

export const BarElement=element('bar');
export const BarSlotElement=Object.freeze({LEFT:element('bar-left'),CENTER:element('bar-center'),RIGHT:element('bar-right')});
// The props of an item that fills its bar's line: its slot stretches to the bar's height inside its border and the
// item fills it (bar.css).
export const BAR_FILL=Object.freeze({'data-bar-fill':true});
// Variant-scoped selectors keep consumers and browser checks on the same contract.
export const barSlotsWithin=(surface: ElementContract)=>({
 LEFT:{...BarSlotElement.LEFT,selector:`${surface.selector}>${BarSlotElement.LEFT.selector}`},
 CENTER:{...BarSlotElement.CENTER,selector:`${surface.selector}>${BarSlotElement.CENTER.selector}`},
 RIGHT:{...BarSlotElement.RIGHT,selector:`${surface.selector}>${BarSlotElement.RIGHT.selector}`},
});
