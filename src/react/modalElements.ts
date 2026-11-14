import type {CSSProperties,RefObject} from 'react';
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
// On a dialog's panel, its width; on a contained Modal's frame, its inset. The stylesheet backs each value with a
// token.
export const MODAL_WIDTH_ATTRIBUTE='data-modal-width';
export const MODAL_FRAME_INSET_ATTRIBUTE='data-modal-frame-inset';
// The frame's inset as its stylesheet resolves it, which a contained panel's top is measured across.
export const MODAL_FRAME_INSET_PROPERTY='--sd-modal-frame-inset';
export const ModalPlacement=Object.freeze({VIEWPORT:'viewport',CONTAINED:'contained',ANCHORED:'anchored'} as const);
export type ModalPlacementValue=(typeof ModalPlacement)[keyof typeof ModalPlacement];
// A dialog, or media (an image or a video) at its own size.
export const ModalForm=Object.freeze({DIALOG:'dialog',MEDIA:'media'} as const);
export type ModalFormValue=(typeof ModalForm)[keyof typeof ModalForm];
// How wide a dialog's panel is: compact for a short dialog and titled for a titled one, each by default; reading for
// a passage; stage for 24 control hit sizes; and fill, for a contained Modal only, its whole frame inside the frame's
// inset.
export const ModalWidth=Object.freeze({
 COMPACT:'compact',TITLED:'titled',READING:'reading',STAGE:'stage',FILL:'fill',
} as const);
export type ModalWidthValue=(typeof ModalWidth)[keyof typeof ModalWidth];
// How far a contained Modal's frame keeps its panel from the positioned parent's edges: the page's inset, by default,
// or the page's gutter.
export const ModalFrameInset=Object.freeze({PAGE:'page',GUTTER:'gutter'} as const);
export type ModalFrameInsetValue=(typeof ModalFrameInset)[keyof typeof ModalFrameInset];
// A contained Modal keeps its frame's inset and may sit at a `top`: 0 or more CSS pixels below its frame's top edge,
// within the inset or past it. A negative or non-finite top is refused when the Modal renders.
type Contained={frameInset?: ModalFrameInsetValue;top?: number};
type NotContained={[Key in keyof Contained]?: never};
type NotAnchored={anchor?: never;group?: never};
// Where a Modal sits. Only an anchored Modal names an anchor, the element it opens from, which is part of its region,
// and a group, of which one is open at a time; it takes its content's width. Only a contained Modal fills its frame.
export type ModalPlacementProps=
 |{placement?: typeof ModalPlacement.VIEWPORT;width?: Exclude<ModalWidthValue,typeof ModalWidth.FILL>}
  &NotAnchored&NotContained
 |{placement: typeof ModalPlacement.CONTAINED;width?: ModalWidthValue}&NotAnchored&Contained
 |{placement: typeof ModalPlacement.ANCHORED;anchor?: RefObject<HTMLElement|null>;group?: string;width?: never}
  &NotContained;
// Media takes its content's size, so it names no width.
export type ModalFormProps={form?: typeof ModalForm.DIALOG}|{form: typeof ModalForm.MEDIA;width?: never};

// A contained panel set at `top` below its frame's top edge: a top within the frame's inset gives a negative margin
// past the inset, which sets the panel into it.
function placedAt(top: number): CSSProperties {
 if(!Number.isFinite(top)||top<0)
  throw new RangeError(`A contained Modal's top is 0 or more CSS pixels below its frame's top edge, not ${top}.`);
 return {alignSelf:'start',marginTop:`calc(${top}px - var(${MODAL_FRAME_INSET_PROPERTY}))`};
}
interface ModalShape extends Contained {
 form: ModalFormValue;
 placement: ModalPlacementValue;
 titled: boolean;
 width?: ModalWidthValue;
}
// What a Modal's stylesheet sizes and places it by. A dialog's panel names its width: its own, or else titled when it
// has a title and compact when it has none. A media or anchored panel takes its content's. A contained frame names its
// inset, and a contained panel given a top sits that far below its frame's top edge, still centred across the frame.
export function modalShape({form,placement,titled,width,frameInset=ModalFrameInset.PAGE,top}: ModalShape) {
 const contained=placement===ModalPlacement.CONTAINED;
 const sized=form===ModalForm.DIALOG&&placement!==ModalPlacement.ANCHORED;
 const panelStyle=contained&&top!==undefined?placedAt(top):{};
 return {
  panel:{[MODAL_PLACEMENT_ATTRIBUTE]:placement,[MODAL_TITLED_ATTRIBUTE]:titled,
   [MODAL_WIDTH_ATTRIBUTE]:sized?width??(titled?ModalWidth.TITLED:ModalWidth.COMPACT):undefined},
  frame:{[MODAL_PLACEMENT_ATTRIBUTE]:placement,[MODAL_FRAME_INSET_ATTRIBUTE]:contained?frameInset:undefined},
  panelStyle,
 };
}
