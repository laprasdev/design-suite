import {element,type ElementContract} from './elementContract.ts';

export const BarElement=element('bar');
export const BarSlotElement=Object.freeze({LEFT:element('bar-left'),CENTER:element('bar-center'),RIGHT:element('bar-right')});
// Variant-scoped selectors keep consumers and browser checks on the same contract.
export const barSlotsWithin=(surface: ElementContract)=>({
 LEFT:{...BarSlotElement.LEFT,selector:`${surface.selector}>${BarSlotElement.LEFT.selector}`},
 CENTER:{...BarSlotElement.CENTER,selector:`${surface.selector}>${BarSlotElement.CENTER.selector}`},
 RIGHT:{...BarSlotElement.RIGHT,selector:`${surface.selector}>${BarSlotElement.RIGHT.selector}`},
});
