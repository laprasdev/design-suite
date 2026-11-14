import type {RefObject} from 'react';
import {element} from './elementContract.ts';

// A titled Modal's parts, shared by its layout, its stylesheet and consumers' browser checks.
export const ModalElement=Object.freeze({
 PANEL:element('sd-modal'),FRAME:element('sd-modal-bg'),
 TITLE:element('sd-modal-title'),ROWS:element('sd-modal-rows'),ROW:element('sd-modal-row'),
 LABEL:element('sd-modal-label'),CONTROL:element('sd-modal-control'),ACTIONS:element('sd-modal-actions'),
});
// On the dialog of a Modal given a title, and on each ModalRow that has a label.
export const MODAL_TITLED_ATTRIBUTE='data-titled';
export const MODAL_ROW_LABELLED_ATTRIBUTE='data-labelled';
export const MODAL_PLACEMENT_ATTRIBUTE='data-modal-placement';
export const ModalPlacement=Object.freeze({VIEWPORT:'viewport',CONTAINED:'contained',ANCHORED:'anchored'} as const);
export type ModalPlacementValue=(typeof ModalPlacement)[keyof typeof ModalPlacement];
// Where a Modal sits. Only an anchored Modal names an anchor, the element it opens from, which is part of its region,
// and a group, of which one is open at a time.
export type ModalPlacementProps=
 |{placement?: typeof ModalPlacement.VIEWPORT|typeof ModalPlacement.CONTAINED;anchor?: never;group?: never}
 |{placement: typeof ModalPlacement.ANCHORED;anchor?: RefObject<HTMLElement|null>;group?: string};
