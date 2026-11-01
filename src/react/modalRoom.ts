/* How far a dialog grows as content opens inside it, shared by Modal and the
   checks that measure it. A held dialog grows up to the golden share of its
   apparent parent, never shrinking one already taller, plus the room it keeps for
   content that opens inside it (Modal's `keepRoomFor`). That room is the content's
   height, as far as the dialog's maximum allows without its resting height falling
   below the golden share; the dialog publishes it as KEPT_ROOM_ATTRIBUTE. */
import {PHI_INVERSE} from '../layout.ts';

export const KEPT_ROOM_ATTRIBUTE = "data-kept-room";
export const keptRoom = (contentHeight: number, maxHeight: number, parentHeight: number) =>
  Math.min(contentHeight, Math.max(0, Math.min(maxHeight, parentHeight) - parentHeight * PHI_INVERSE));
export const modalGrowthLimit = (height: number, parentHeight: number, room = 0) => Math.max(height + room, parentHeight * PHI_INVERSE);
// A dialog scrolls by whole pixels: a reader's scroll moves at least this far, and an
// engine snapping a resized dialog to its pixel grid moves it by less.
export const SCROLL_STEP_PX = 1;
