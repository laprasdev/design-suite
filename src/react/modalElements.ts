import {element} from './elementContract.ts';

// A titled Modal's parts, shared by its layout, its stylesheet and consumers' browser checks.
export const ModalElement=Object.freeze({
 TITLE:element('sd-modal-title'),ROWS:element('sd-modal-rows'),ROW:element('sd-modal-row'),
 LABEL:element('sd-modal-label'),CONTROL:element('sd-modal-control'),ACTIONS:element('sd-modal-actions'),
});
// On the dialog of a Modal given a title, and on each ModalRow that has a label.
export const MODAL_TITLED_ATTRIBUTE='data-titled';
export const MODAL_ROW_LABELLED_ATTRIBUTE='data-labelled';
