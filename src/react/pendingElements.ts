// The pending form's DOM contract (pending.tsx): its element, and what its Poké Ball sits with: text, beside it
// at the pending spinner's size, or a selection mark, the ball laid over it at the mark's size so the value being saved
// stays in view.
import {element} from './elementContract.ts';

export const PendingElement=element('bd-pending'),PENDING_FORM_ATTRIBUTE='data-form';
export const PendingForm=Object.freeze({TEXT:'text',MARK:'mark'} as const);
export type PendingForm=typeof PendingForm[keyof typeof PendingForm];
